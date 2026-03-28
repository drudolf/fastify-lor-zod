import type { FastifySchema } from 'fastify';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { z } from 'zod';

import {
  getOASVersion,
  getRegistryIdMap,
  jsonSchemaToOAS,
  type ZodToJsonConfig,
  zodSchemaToJson,
} from './zod-to-openapi.js';

type JSONSchemaRecord = Record<string, unknown>;
type SwaggerDocumentObject =
  | { swaggerObject: Partial<OpenAPIV3.Document> }
  | { openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document> };

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
  /** When `true`, also generates `{Id}Input` variants in `components.schemas`. Defaults to `false`. */
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
  throw new Error(`Invalid schema: ${JSON.stringify(maybeSchema)}`);
};

const isContentTypeWrapper = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'content' in value &&
  typeof (value as Record<string, unknown>).content === 'object';

const transformContentTypes = (
  wrapper: Record<string, unknown>,
  schemaRegistry: typeof z.globalRegistry,
  io: 'input' | 'output',
  oasVersion: '3.0' | '3.1',
  zodToJsonConfig: ZodToJsonConfig,
): Record<string, unknown> => {
  const content = wrapper.content as Record<string, unknown>;
  const transformedContent: Record<string, unknown> = {};

  for (const [mimeType, mimeEntry] of Object.entries(content)) {
    if (typeof mimeEntry === 'object' && mimeEntry !== null && 'schema' in mimeEntry) {
      const schemaValue = (mimeEntry as Record<string, unknown>).schema;
      if (schemaValue instanceof z.ZodType) {
        const jsonSchema = zodSchemaToJson(
          schemaValue,
          schemaRegistry,
          io,
          oasVersion,
          zodToJsonConfig,
        );
        transformedContent[mimeType] = {
          ...(mimeEntry as Record<string, unknown>),
          schema: jsonSchemaToOAS(jsonSchema, oasVersion),
        };
      } else {
        transformedContent[mimeType] = mimeEntry;
      }
    } else {
      transformedContent[mimeType] = mimeEntry;
    }
  }

  return { ...wrapper, content: transformedContent };
};

/**
 * Creates a Fastify Swagger `transform` function that converts Zod schemas to OpenAPI JSON Schema.
 *
 * Processes all HTTP parts uniformly (body, querystring, params, headers, response).
 * Automatically uses `io: "input"` for request schemas and `io: "output"` for response schemas.
 * Supports nested content types in body and response, and preserves extra wrapper keys
 * like `description`.
 *
 * @param opts - Optional configuration (skip list, registry, JSON config)
 * @returns A `transform` function compatible with `@fastify/swagger`
 *
 * @example
 * ```ts
 * app.register(swagger, {
 *   transform: createJsonSchemaTransform({
 *     schemaRegistry: myRegistry,
 *     zodToJsonConfig: { override: (ctx) => { ... } },
 *   }),
 * });
 * ```
 */
export const createJsonSchemaTransform = (
  opts: SchemaTransformOptions = {},
): ((
  args: {
    schema: Schema;
    url: string;
    route: unknown;
  } & SwaggerDocumentObject,
) => { schema: Schema | JSONSchemaRecord; url: string }) => {
  const {
    skipList = DEFAULT_SKIP_LIST,
    schemaRegistry = z.globalRegistry,
    zodToJsonConfig = {},
  } = opts;

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
 * Iterates over all schemas in the registry, converts each to JSON Schema via
 * `zodSchemaToJson`, and merges them into the OpenAPI document's components.
 * Set `withInputSchema: true` to also generate `{Id}Input` variants.
 *
 * @param opts - Optional configuration (registry, input schemas, JSON config)
 * @returns A `transformObject` function compatible with `@fastify/swagger`
 *
 * @example
 * ```ts
 * const registry = z.registry<{ id: string }>();
 * registry.add(UserSchema, { id: 'User' });
 *
 * app.register(swagger, {
 *   transformObject: createJsonSchemaTransformObject({ schemaRegistry: registry }),
 * });
 * ```
 */
export const createJsonSchemaTransformObject = (
  opts: SchemaTransformOptions = {},
): ((
  documentObject: SwaggerDocumentObject,
) => Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>) => {
  const { schemaRegistry = z.globalRegistry, withInputSchema = false, zodToJsonConfig = {} } = opts;

  return (documentObject) => {
    if ('swaggerObject' in documentObject) {
      throw new Error('OpenAPI 2.0 is not supported');
    }

    const oasVersion = getOASVersion(documentObject);

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

      if (withInputSchema) {
        const inputJson = zodSchemaToJson(
          schema,
          schemaRegistry,
          'input',
          oasVersion,
          zodToJsonConfig,
          'params',
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
 * Pre-configured JSON Schema transform for `@fastify/swagger`.
 *
 * Uses `z.globalRegistry` and default settings. For custom configuration,
 * use {@link createJsonSchemaTransform} instead.
 */
export const jsonSchemaTransform: ReturnType<typeof createJsonSchemaTransform> =
  createJsonSchemaTransform();

/**
 * Pre-configured JSON Schema transform object for `@fastify/swagger`.
 *
 * Uses `z.globalRegistry` and default settings. For custom configuration,
 * use {@link createJsonSchemaTransformObject} instead.
 */
export const jsonSchemaTransformObject: ReturnType<typeof createJsonSchemaTransformObject> =
  createJsonSchemaTransformObject();
