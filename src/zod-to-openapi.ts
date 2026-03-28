import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import type { z } from 'zod';
import type { JSONSchema } from 'zod/v4/core';
import { $ZodRegistry, $ZodType, toJSONSchema } from 'zod/v4/core';

type OASVersion = '3.0' | '3.1';

type JSONSchemaRecord = Record<string, unknown>;

// --- Internal Zod types not exposed in public API ---

/** Internal shape of `schema._zod.def` for type introspection. */
interface ZodDef {
  type: string;
  in?: ZodInternal;
  out?: ZodInternal;
}

/** Subset of Zod's internal schema shape used for introspection and JSON Schema generation. */
interface ZodInternal {
  _zod: { def: ZodDef };
  toJSONSchema: (params: unknown) => JSONSchemaRecord;
}

/** Internal registry shape exposing the id→schema map. */
interface ZodRegistryInternal {
  _idmap: Map<string, z.ZodType>;
}

const asInternal = (entity: unknown): ZodInternal => entity as unknown as ZodInternal;

/* v8 ignore start -- defensive guard: callers always pass ZodType */
const getZodDef = (entity: unknown): ZodDef | undefined =>
  entity instanceof $ZodType ? asInternal(entity)._zod.def : undefined;
/* v8 ignore stop */

// --- Zod-to-JSON helpers ---

const getSchemaId = (id: string, io: 'input' | 'output'): string =>
  io === 'input' ? `${id}Input` : id;

const getReferenceUri = (id: string, io: 'input' | 'output'): string =>
  `#/components/schemas/${getSchemaId(id, io)}`;

/** Returns the id→schema map from a Zod registry. */
export const getRegistryIdMap = (registry: typeof z.globalRegistry): Map<string, z.ZodType> =>
  (registry as unknown as ZodRegistryInternal)._idmap;

const getOverride = (
  ctx: { zodSchema: unknown; jsonSchema: JSONSchema.BaseSchema },
  io: 'input' | 'output',
  target: string,
): void => {
  const def = getZodDef(ctx.zodSchema);
  /* v8 ignore next */
  if (!def) return;

  if (def.type === 'union') {
    ctx.jsonSchema.anyOf = ctx.jsonSchema.anyOf?.filter(
      (schema: JSONSchemaRecord) => Object.keys(schema).length > 0,
    );
  }

  if (def.type === 'date' && io === 'output') {
    ctx.jsonSchema.type = 'string';
    ctx.jsonSchema.format = 'date-time';
  }

  if (def.type === 'undefined' && io === 'output') {
    ctx.jsonSchema.type = 'null';
  }

  // When output of a pipe is a transform, Zod produces {} because the transform
  // function's return type is unrepresentable in JSON Schema. Fall back to the
  // input side of the pipe, which is the best documentation we can produce.
  if (
    def.type === 'pipe' &&
    io === 'output' &&
    def.out?._zod.def.type === 'transform' &&
    Object.keys(ctx.jsonSchema).length === 0
  ) {
    const inputJsonSchema = toJSONSchema(def.in as unknown as $ZodType, {
      target,
      io: 'input',
      unrepresentable: 'any',
    });
    Object.assign(ctx.jsonSchema, inputJsonSchema);
  }
};

/** Override callback context passed to `toJSONSchema`. */
interface OverrideContext {
  zodSchema: unknown;
  jsonSchema: JSONSchema.BaseSchema;
  path: (string | number)[];
}

/** Configuration for Zod-to-JSON Schema conversion. */
export interface ZodToJsonConfig {
  target?: string;
  /** Custom override applied after the built-in overrides (date, undefined, transform). */
  override?: (ctx: OverrideContext) => void;
}

const PARAM_PARTS = new Set(['querystring', 'params', 'headers']);

/**
 * Converts a single Zod schema to a JSON Schema, with proper `$ref` handling
 * for schemas registered in the provided registry.
 *
 * Uses Zod's `external` registry mechanism to resolve `$ref` paths natively —
 * no placeholder strings or JSON roundtrips needed.
 *
 * @param zodSchema - The Zod schema to convert
 * @param registry - Schema registry for resolving references
 * @param io - Whether this is an input or output schema
 * @param oasVersion - Target OAS version
 * @param config - Optional configuration
 * @param httpPart - The HTTP part being converted (body, querystring, params, headers)
 * @returns JSON Schema object
 */
export const zodSchemaToJson = (
  zodSchema: z.ZodType,
  registry: typeof z.globalRegistry,
  io: 'input' | 'output',
  oasVersion: OASVersion,
  config: ZodToJsonConfig = {},
  httpPart?: string,
): JSONSchemaRecord => {
  const defaultTarget = oasVersion === '3.0' ? 'openapi-3.0' : 'draft-2020-12';
  const target = config.target ?? defaultTarget;

  const schemaId = registry.get(zodSchema)?.id;

  // Registered schemas return $ref directly — except for querystring/params/headers
  // where @fastify/swagger needs inlined properties to generate individual parameters
  if (schemaId && (!httpPart || !PARAM_PARTS.has(httpPart))) {
    return { $ref: getReferenceUri(schemaId, io) };
  }

  // Build an external registry containing only explicitly-registered schemas (those with
  // an `id`). This prevents schemas that only have .describe() metadata from being
  // extracted as $ref — only schemas the user explicitly registered get $ref treatment.
  const externalRegistry = new $ZodRegistry<{ id?: string }>();
  for (const [id, schema] of getRegistryIdMap(registry)) {
    externalRegistry.add(schema, { id });
  }

  // If the schema isn't registered, add it under a temp id so Zod's external mechanism
  // can resolve it. Registered schemas are already in externalRegistry under their real id.
  if (!schemaId) externalRegistry.add(zodSchema, { id: schemaId ?? '__target__' });

  // Zod populates `defs` with extracted definitions (e.g. from z.json() cycles).
  // We merge them back into the result as `definitions` so $ref paths resolve.
  const defs: Record<string, JSONSchemaRecord> = {};

  const result = asInternal(zodSchema).toJSONSchema({
    target,
    io,
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    external: {
      registry: externalRegistry,
      uri: (id: string) => {
        if (id === '__target__' || id === '__shared') return '';
        return getReferenceUri(id, io);
      },
      defs,
    },
    override: (ctx: OverrideContext) => {
      getOverride(ctx, io, target);
      config.override?.(ctx);
    },
  });

  const jsonSchema: JSONSchemaRecord = { ...result };
  delete jsonSchema.$id;
  delete jsonSchema.id;
  delete jsonSchema['~standard'];

  if (Object.keys(defs).length > 0) {
    jsonSchema.definitions = defs;
  }

  return jsonSchema;
};

// --- JSON Schema to OAS conversion ---

/**
 * Gets the OAS version from a Swagger document object.
 *
 * @param documentObject - The Swagger/OpenAPI document object
 * @returns The detected OAS version
 */
export const getOASVersion = (documentObject: {
  openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>;
}): OASVersion => {
  const openapiVersion = documentObject.openapiObject.openapi || '3.0.3';

  if (openapiVersion.startsWith('3.1')) return '3.1';
  if (openapiVersion.startsWith('3.0')) return '3.0';

  throw new Error('Unsupported OpenAPI document object');
};

const OAS30_DELETE_KEYS = [
  '$schema',
  '$id',
  'unevaluatedProperties',
  'dependentSchemas',
  'patternProperties',
  'propertyNames',
  'contentEncoding',
  'contentMediaType',
] as const;

const jsonSchemaToOAS30 = (jsonSchema: JSONSchemaRecord): JSONSchemaRecord => {
  const clone: JSONSchemaRecord = { ...jsonSchema };

  for (const key of OAS30_DELETE_KEYS) delete clone[key];

  const recursive = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map((item) => jsonSchemaToOAS30(item as JSONSchemaRecord))
      : jsonSchemaToOAS30(v as JSONSchemaRecord);

  if (clone.properties && typeof clone.properties === 'object') {
    for (const [k, v] of Object.entries(clone.properties as Record<string, JSONSchemaRecord>)) {
      (clone.properties as Record<string, JSONSchemaRecord>)[k] = jsonSchemaToOAS30(v);
    }
  }

  if (clone.items && typeof clone.items === 'object' && !Array.isArray(clone.items)) {
    clone.items = recursive(clone.items);
  }

  for (const key of ['allOf', 'anyOf', 'oneOf', 'not', 'then', 'else', 'if', 'contains'] as const) {
    if (clone[key]) {
      clone[key] = recursive(clone[key]);
    }
  }

  return clone;
};

/**
 * Converts a JSON Schema to an OpenAPI-compatible schema.
 *
 * @param schema - JSON Schema object
 * @param oasVersion - Target OpenAPI version
 * @returns OpenAPI-compatible schema object
 */
export const jsonSchemaToOAS = (
  schema: JSONSchemaRecord,
  oasVersion: OASVersion,
): JSONSchemaRecord => {
  if (oasVersion === '3.1') return schema;
  return jsonSchemaToOAS30(schema);
};
