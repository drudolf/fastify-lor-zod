import type { SwaggerTransform, SwaggerTransformObject } from '@fastify/swagger';
import type { FastifySchema } from 'fastify';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { z } from 'zod';

import { schemaDiverges } from '../utils/schema-diverges.js';
import {
  getOASVersion,
  getRegistryIdMap,
  jsonSchemaToOAS,
  type OASVersion,
  type ZodToJsonConfig,
  zodSchemaToJson,
} from './zod-to-openapi.js';

type JSONSchemaRecord = Record<string, unknown>;
interface Schema extends FastifySchema {
  hide?: boolean;
}

/**
 * Options for {@link createJsonSchemaTransform} and {@link createJsonSchemaTransformObject}.
 */
export interface SchemaTransformOptions {
  /** Route URL patterns to exclude from OpenAPI documentation (e.g. `/documentation/*`). */
  skipList?: readonly string[];
  /** Custom schema registry for `$ref` component resolution (defaults to `z.globalRegistry`). */
  schemaRegistry?: typeof z.globalRegistry;
  /**
   * Controls how request body `$ref`s and `components.schemas` Input variants are generated.
   *
   * @deprecated No longer needed — input schema variants are now auto-detected by comparing
   * each registered schema's input and output JSON Schema representations. Schemas with
   * transforms, codecs, or defaults that cause divergence automatically get `{Id}Input` variants.
   *
   * - `undefined` (default): auto-detect — only divergent schemas get Input variants.
   * - `true`: force Input variants for **all** registered schemas (legacy behavior).
   * - `false`: suppress all Input variants.
   */
  withInputSchema?: boolean;
  /** Configuration for Zod-to-JSON Schema conversion (e.g. custom `target` or `override`). */
  zodToJsonConfig?: ZodToJsonConfig;
}

const DEFAULT_SKIP_LIST = [
  '/documentation/',
  '/documentation/initOAuth',
  '/documentation/json',
  '/documentation/uiConfig',
  '/documentation/yaml',
  '/documentation/*',
  '/documentation/static/*',
] as const;

interface ResolvedSchema {
  schema: z.ZodType;
  /** Extra keys from a wrapper object (e.g. `description`) to merge into the OAS output. */
  extras: Record<string, unknown>;
}

const resolveSchema = (maybeSchema: z.ZodType | { properties: z.ZodType }): ResolvedSchema => {
  if (maybeSchema instanceof z.ZodType) {
    return { schema: maybeSchema, extras: {} };
  }
  if (
    'properties' in maybeSchema &&
    (maybeSchema as { properties: unknown }).properties instanceof z.ZodType
  ) {
    const { properties, ...extras } = maybeSchema as Record<string, unknown>;
    return { schema: properties as z.ZodType, extras };
  }
  throw new Error(
    `[fastify-lor-zod] Expected a Zod schema or { properties: ZodType } wrapper, received: ${JSON.stringify(maybeSchema)}`,
  );
};

const isContentTypeWrapper = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'content' in value &&
  typeof (value as Record<string, unknown>).content === 'object';

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Builds the set of registered schema IDs whose input/output shapes diverge.
 *
 * - `withInputSchema === true`: returns all registry IDs (legacy: generate Input for everything)
 * - `withInputSchema === false`: returns empty set (suppress all Input variants)
 * - `withInputSchema === undefined`: auto-detect via JSON schema comparison
 */
const resolveDivergentIds = (
  schemaRegistry: typeof z.globalRegistry,
  withInputSchema: boolean | undefined,
): ReadonlySet<string> => {
  const idmap = getRegistryIdMap(schemaRegistry);

  if (withInputSchema === true) return new Set(idmap.keys());
  if (withInputSchema === false) return EMPTY_SET;

  // Auto-detect: compare input vs output JSON schemas
  const ids = new Set<string>();
  for (const [id, schema] of idmap) {
    if (schemaDiverges(schema)) ids.add(id);
  }
  return ids;
};

const transformContentTypes = (
  wrapper: Record<string, unknown>,
  schemaRegistry: typeof z.globalRegistry,
  io: 'input' | 'output',
  oasVersion: OASVersion,
  zodToJsonConfig: ZodToJsonConfig,
  inputSchemaIds: ReadonlySet<string> = EMPTY_SET,
): Record<string, unknown> => {
  const content = wrapper.content as Record<string, unknown>;
  const transformedContent: Record<string, unknown> = {};

  for (const [mimeType, mimeEntry] of Object.entries(content)) {
    const schemaValue =
      typeof mimeEntry === 'object' && mimeEntry !== null && 'schema' in mimeEntry
        ? (mimeEntry as Record<string, unknown>).schema
        : undefined;

    if (!(schemaValue instanceof z.ZodType)) {
      transformedContent[mimeType] = mimeEntry;
      continue;
    }

    const jsonSchema = zodSchemaToJson(
      schemaValue,
      schemaRegistry,
      io,
      oasVersion,
      zodToJsonConfig,
      undefined,
      inputSchemaIds,
    );
    transformedContent[mimeType] = {
      ...(mimeEntry as Record<string, unknown>),
      schema: jsonSchemaToOAS(jsonSchema, oasVersion),
    };
  }

  return { ...wrapper, content: transformedContent };
};

/**
 * Creates a Fastify Swagger `transform` function that converts Zod schemas to OpenAPI JSON Schema.
 *
 * Called once per route during spec generation. Converts Zod schemas in body, querystring,
 * params, headers, and response to JSON Schema. Automatically uses `io: "input"` for request
 * schemas and `io: "output"` for response schemas. Supports nested content types and
 * preserves extra wrapper keys like `description`.
 *
 * Can be used standalone or paired with {@link createJsonSchemaTransformObject}:
 *
 * - **No registered schemas**: works fully standalone — all schemas are inlined.
 * - **With registered schemas**: registered schemas emit `$ref`s pointing to `components.schemas`.
 *   Pair with {@link createJsonSchemaTransformObject} to populate those component definitions,
 *   or use {@link createJsonSchemaTransforms} for a single-call setup.
 *
 * @param opts - Optional configuration (skip list, registry, JSON config)
 * @param divergentIds - Pre-computed set of schema IDs whose input/output shapes diverge.
 *   When omitted, resolved automatically from the registry on first invocation.
 * @returns A `transform` function compatible with `@fastify/swagger`
 *
 * @example
 * ```ts
 * // Standalone (no registry)
 * app.register(swagger, {
 *   transform: createJsonSchemaTransform(),
 * });
 *
 * // With registry — pair with transformObject
 * const opts = { schemaRegistry: myRegistry };
 * app.register(swagger, {
 *   transform: createJsonSchemaTransform(opts),
 *   transformObject: createJsonSchemaTransformObject(opts),
 * });
 * ```
 */
export const createJsonSchemaTransform = (
  opts: SchemaTransformOptions = {},
  divergentIds?: ReadonlySet<string>,
): SwaggerTransform<Schema> => {
  const {
    skipList = DEFAULT_SKIP_LIST,
    schemaRegistry = z.globalRegistry,
    withInputSchema,
    zodToJsonConfig = {},
  } = opts;

  let inputSchemaIds = divergentIds;

  return (input) => {
    if ('swaggerObject' in input) throw new Error('OpenAPI 2.0 is not supported');

    const { schema, url } = input;

    if (!schema) {
      return { schema, url };
    }

    const { response, headers, querystring, body, params, hide, ...rest } = schema;

    const transformed: JSONSchemaRecord = {};

    if (skipList.includes(url) || hide) {
      transformed.hide = true;
      return { schema: transformed, url };
    }

    const oasVersion = getOASVersion(input);

    // Lazily resolve divergent IDs on first invocation (when OAS version is known)
    inputSchemaIds ??= resolveDivergentIds(schemaRegistry, withInputSchema);

    const zodSchemas: Record<string, unknown> = { headers, querystring, body, params };

    for (const prop in zodSchemas) {
      const zodSchema = zodSchemas[prop];
      if (!zodSchema) continue;

      // Body can use content-type wrappers (#132)
      if (prop === 'body' && isContentTypeWrapper(zodSchema)) {
        transformed[prop] = transformContentTypes(
          zodSchema as Record<string, unknown>,
          schemaRegistry,
          'input',
          oasVersion,
          zodToJsonConfig,
          inputSchemaIds,
        );
        continue;
      }

      const jsonSchema = zodSchemaToJson(
        zodSchema as z.ZodType,
        schemaRegistry,
        'input',
        oasVersion,
        zodToJsonConfig,
        prop,
        inputSchemaIds,
      );
      transformed[prop] = jsonSchemaToOAS(jsonSchema, oasVersion);
    }

    if (response) {
      transformed.response = {};

      for (const prop in response as Record<string, unknown>) {
        const responseEntry = (response as Record<string, unknown>)[prop];

        // Nested content types (#227): { content: { 'mime': { schema: ZodType } } }
        if (isContentTypeWrapper(responseEntry)) {
          (transformed.response as JSONSchemaRecord)[prop] = transformContentTypes(
            responseEntry as Record<string, unknown>,
            schemaRegistry,
            'output',
            oasVersion,
            zodToJsonConfig,
          );
          continue;
        }

        const { schema: zodSchema, extras } = resolveSchema(responseEntry as z.ZodType);
        const jsonSchema = zodSchemaToJson(
          zodSchema,
          schemaRegistry,
          'output',
          oasVersion,
          zodToJsonConfig,
        );

        // If the JSON schema is null, return as-is since fastify-swagger will handle it
        if ((jsonSchema as JSONSchemaRecord).type === 'null') {
          (transformed.response as JSONSchemaRecord)[prop] = { ...extras, ...jsonSchema };
          continue;
        }

        const oasSchema = jsonSchemaToOAS(jsonSchema, oasVersion);
        if (extras.description === '') delete extras.description;
        (transformed.response as JSONSchemaRecord)[prop] = { ...extras, ...oasSchema };
      }
    }

    for (const prop in rest) {
      const meta = rest[prop as keyof typeof rest];
      if (meta) {
        transformed[prop] = meta;
      }
    }

    return { schema: transformed, url };
  };
};

/**
 * Creates a Fastify Swagger `transformObject` function that resolves Zod registry schemas
 * into OpenAPI `$ref`-based `components.schemas`.
 *
 * Called once after all routes are processed. Iterates over all schemas in the registry,
 * converts each to JSON Schema, and merges them into the OpenAPI document's components.
 * Schemas whose input and output shapes diverge (e.g. due to defaults, transforms, or codecs)
 * automatically get `{Id}Input` variants.
 *
 * Only useful when using a schema registry — without one, there are no components to populate.
 * Pair with {@link createJsonSchemaTransform} to convert route-level Zod schemas to JSON Schema,
 * or use {@link createJsonSchemaTransforms} for a single-call setup.
 *
 * @param opts - Optional configuration (registry, JSON config)
 * @param divergentIds - Pre-computed set of schema IDs whose input/output shapes diverge.
 *   When omitted, resolved automatically from the registry.
 * @returns A `transformObject` function compatible with `@fastify/swagger`
 *
 * @example
 * ```ts
 * const opts = { schemaRegistry: myRegistry };
 * app.register(swagger, {
 *   transform: createJsonSchemaTransform(opts),
 *   transformObject: createJsonSchemaTransformObject(opts),
 * });
 * ```
 */
export const createJsonSchemaTransformObject = (
  opts: SchemaTransformOptions = {},
  divergentIds?: ReadonlySet<string>,
): SwaggerTransformObject => {
  const { schemaRegistry = z.globalRegistry, withInputSchema, zodToJsonConfig = {} } = opts;

  return (documentObject) => {
    if ('swaggerObject' in documentObject) {
      throw new Error('OpenAPI 2.0 is not supported');
    }

    const oasVersion = getOASVersion(documentObject);
    const inputSchemaIds = divergentIds ?? resolveDivergentIds(schemaRegistry, withInputSchema);

    const oasSchemas: Record<string, Record<string, unknown>> = {};
    const idmap = getRegistryIdMap(schemaRegistry);

    for (const [id, schema] of idmap) {
      // Pass httpPart to bypass the $ref early-return — we need the full inlined
      // schema for component definitions, not a self-referencing $ref
      const outputJson = zodSchemaToJson(
        schema,
        schemaRegistry,
        'output',
        oasVersion,
        zodToJsonConfig,
        'params',
      );
      oasSchemas[id] = jsonSchemaToOAS(outputJson, oasVersion);

      if (inputSchemaIds.has(id)) {
        const inputJson = zodSchemaToJson(
          schema,
          schemaRegistry,
          'input',
          oasVersion,
          zodToJsonConfig,
          'params',
          inputSchemaIds,
        );
        oasSchemas[`${id}Input`] = jsonSchemaToOAS(inputJson, oasVersion);
      }
    }

    return {
      ...documentObject.openapiObject,
      components: {
        ...documentObject.openapiObject.components,
        schemas: {
          ...documentObject.openapiObject.components?.schemas,
          ...oasSchemas,
        },
      },
    } as Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>;
  };
};

/**
 * Convenience wrapper that creates both `transform` and `transformObject` from a single
 * options object.
 *
 * Pre-computes the divergent schema set once and shares it between both functions, avoiding
 * a redundant registry scan. Functionally equivalent to calling {@link createJsonSchemaTransform}
 * and {@link createJsonSchemaTransformObject} separately — each resolves divergent IDs on its
 * own when not provided.
 *
 * Use this when you need both transforms (i.e. you're using a schema registry). If you only
 * need route-level conversion without a registry, {@link createJsonSchemaTransform} alone is
 * sufficient.
 *
 * @param opts - Optional configuration (skip list, registry, JSON config)
 * @returns An object with `transform` and `transformObject` — spread directly into `swagger()` options
 *
 * @example
 * ```ts
 * await app.register(swagger, {
 *   openapi: { openapi: '3.0.3', info: { title: 'My API', version: '1.0.0' } },
 *   ...createJsonSchemaTransforms({ schemaRegistry: myRegistry }),
 * });
 * ```
 */
export const createJsonSchemaTransforms = (
  opts: SchemaTransformOptions = {},
): { transform: SwaggerTransform<Schema>; transformObject: SwaggerTransformObject } => {
  const { schemaRegistry = z.globalRegistry, withInputSchema } = opts;

  // Shared divergent IDs — resolved once, shared between both functions
  const ids = resolveDivergentIds(schemaRegistry, withInputSchema);

  return {
    transform: createJsonSchemaTransform(opts, ids),
    transformObject: createJsonSchemaTransformObject(opts, ids),
  };
};

/**
 * Pre-configured JSON Schema transform for `@fastify/swagger`.
 *
 * Uses `z.globalRegistry` and default settings. Works standalone for projects without
 * a custom registry. For custom configuration, use {@link createJsonSchemaTransform}
 * or {@link createJsonSchemaTransforms}.
 */
export const jsonSchemaTransform: SwaggerTransform<Schema> = createJsonSchemaTransform();

/**
 * Pre-configured JSON Schema transform object for `@fastify/swagger`.
 *
 * Uses `z.globalRegistry` and default settings. Pair with {@link jsonSchemaTransform}
 * when using `z.globalRegistry` for `$ref`-based component definitions. For custom
 * configuration, use {@link createJsonSchemaTransformObject} or {@link createJsonSchemaTransforms}.
 */
export const jsonSchemaTransformObject: SwaggerTransformObject = createJsonSchemaTransformObject();
