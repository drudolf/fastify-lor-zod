import fastJsonStringify from 'fast-json-stringify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import { z } from 'zod';

import { hasCodecInTree } from '../utils/has-codec-in-tree.js';
import { hasTransformInTree } from '../utils/has-transform-in-tree.js';
import { ResponseSerializationError } from './error.js';

type MaybeWrappedSchema = z.ZodType | { properties: z.ZodType };

/**
 * Unwraps Fastify's `{ properties: ZodType }` response wrapper used to attach
 * OAS metadata (e.g. `description`) at the route level. Returns the inner Zod
 * schema, or `undefined` when no Zod schema is present.
 */
const resolveSchema = (maybeSchema: MaybeWrappedSchema | undefined): z.ZodType | undefined => {
  if (maybeSchema instanceof z.ZodType) return maybeSchema;
  if (maybeSchema?.properties instanceof z.ZodType) return maybeSchema.properties;
  return undefined;
};

/**
 * Options for the serializer compiler factories.
 *
 * Applies to `createSerializerCompiler` and `createParseSerializerCompiler`.
 * The `createFastSerializerCompiler` does not use `JSON.stringify` and ignores these options.
 */
export interface SerializerCompilerOptions {
  /**
   * Custom replacer function passed to `JSON.stringify`.
   *
   * @example
   * ```ts
   * const compiler = createSerializerCompiler({
   *   replacer: (key, value) => key === 'secret' ? '[REDACTED]' : value,
   * });
   * ```
   */
  replacer?: (key: string, value: unknown) => unknown;
}

/**
 * Creates a Fastify serializer compiler that auto-detects whether to use `safeEncode` or `safeParse`.
 *
 * At compile time (when Fastify registers a route), inspects the schema tree for codec/pipe types.
 * If codecs are found, uses `safeEncode` to run reverse transforms (domain type → wire format).
 * If no codecs are found, uses `safeParse` for ~15% faster validation-only serialization.
 *
 * This is the **recommended default** — it gives the best of both worlds without manual selection.
 * Throws {@link ResponseSerializationError} on failure.
 *
 * @param opts - Optional configuration (e.g. custom `JSON.stringify` replacer)
 * @returns A Fastify serializer compiler function
 *
 * @example
 * ```ts
 * // With custom replacer to redact sensitive fields
 * app.setSerializerCompiler(createSerializerCompiler({
 *   replacer: (key, value) => key === 'password' ? '[REDACTED]' : value,
 * }));
 * ```
 */
export const createSerializerCompiler =
  (opts: SerializerCompilerOptions = {}): FastifySerializerCompiler<MaybeWrappedSchema> =>
  ({ schema: maybeSchema, method, url, httpStatus }) => {
    const schema = resolveSchema(maybeSchema);
    if (!schema) {
      return (data: unknown): string => JSON.stringify(data, opts.replacer);
    }

    const hasCodec = hasCodecInTree(schema);
    const hasTransform = hasTransformInTree(schema);

    if (hasCodec && hasTransform) {
      throw new Error(
        `[fastify-lor-zod] Mixed codec+transform response schemas are not supported for serialization: ${method} ${url}. ` +
          'Use only codecs or only one-way transforms in a response schema, or provide a custom serializer.',
      );
    }

    const useEncode = hasCodec;
    const validate = useEncode ? schema.safeEncode : schema.safeParse;

    return (data: unknown): string => {
      const result = validate(data);
      if (!result.success) {
        throw new ResponseSerializationError({
          method,
          url,
          httpStatus,
          zodError: result.error,
        });
      }
      return JSON.stringify(result.data, opts.replacer);
    };
  };

/**
 * Default serializer compiler with auto-detect codec support.
 *
 * Automatically uses `safeEncode` for schemas with codecs/pipes, and `safeParse`
 * for plain schemas (~15% faster). This is the recommended serializer for most applications.
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(serializerCompiler);
 * ```
 */
export const serializerCompiler: FastifySerializerCompiler<MaybeWrappedSchema> =
  createSerializerCompiler();

/**
 * Creates a Fastify serializer compiler that always uses Zod's `safeParse` for response validation.
 *
 * Always uses `safeParse`, never `safeEncode` — does **not** run reverse transforms for codec schemas.
 * For most use cases, prefer {@link createSerializerCompiler} which auto-detects codecs and
 * uses `safeParse` for non-codec schemas automatically.
 *
 * Throws {@link ResponseSerializationError} on validation failure.
 *
 * @param opts - Optional configuration (e.g. custom `JSON.stringify` replacer)
 * @returns A Fastify serializer compiler function
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(createParseSerializerCompiler());
 * ```
 */
export const createParseSerializerCompiler =
  (opts: SerializerCompilerOptions = {}): FastifySerializerCompiler<MaybeWrappedSchema> =>
  ({ schema: maybeSchema, method, url, httpStatus }) => {
    const schema = resolveSchema(maybeSchema);
    if (!schema) {
      return (data: unknown): string => JSON.stringify(data, opts.replacer);
    }

    return (data: unknown): string => {
      const result = schema.safeParse(data);
      if (!result.success) {
        throw new ResponseSerializationError({
          method,
          url,
          httpStatus,
          zodError: result.error,
        });
      }
      return JSON.stringify(result.data, opts.replacer);
    };
  };

/**
 * Default validating serializer using `safeParse` + `JSON.stringify`.
 *
 * Always uses `safeParse`, skips codec encoding. Prefer {@link serializerCompiler}
 * which auto-detects and matches this speed for non-codec schemas.
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(parseSerializerCompiler);
 * ```
 */
export const parseSerializerCompiler: FastifySerializerCompiler<MaybeWrappedSchema> =
  createParseSerializerCompiler();

/**
 * Creates a Fastify serializer compiler that uses `fast-json-stringify` for maximum performance.
 *
 * Converts the Zod schema to JSON Schema **once** at route registration, then uses the
 * pre-compiled `fast-json-stringify` function for every request. No Zod validation is
 * performed — responses are serialized directly without type checking.
 *
 * Use this when response validation is not needed and throughput is critical.
 * For response validation, use {@link createSerializerCompiler} or
 * {@link createParseSerializerCompiler} instead.
 *
 * @returns A Fastify serializer compiler function
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(createFastSerializerCompiler());
 * ```
 */
export const createFastSerializerCompiler =
  (): FastifySerializerCompiler<MaybeWrappedSchema> =>
  ({ schema: maybeSchema }) => {
    const schema = resolveSchema(maybeSchema);
    if (!schema) {
      return (data: unknown): string => JSON.stringify(data);
    }

    const jsonSchema = z.toJSONSchema(schema, {
      target: 'draft-2020-12',
      io: 'output',
      unrepresentable: 'any',
    });
    const stringify = fastJsonStringify(jsonSchema as Record<string, unknown>);
    return (data: unknown): string => stringify(data);
  };

/**
 * Default fast serializer using `fast-json-stringify` (no validation).
 *
 * The fastest option — pre-compiles a JSON Schema stringify function at route
 * registration. No runtime validation is performed on responses.
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(fastSerializerCompiler);
 * ```
 */
export const fastSerializerCompiler: FastifySerializerCompiler<MaybeWrappedSchema> =
  createFastSerializerCompiler();
