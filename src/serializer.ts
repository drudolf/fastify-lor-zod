import fastJsonStringify from 'fast-json-stringify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import { z } from 'zod';

import { ResponseSerializationError } from './errors.js';

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
 * Creates a Fastify serializer compiler that uses Zod v4's `safeEncode` for response serialization.
 *
 * This is the **recommended default**. For codec schemas, `safeEncode` runs the reverse
 * transform (domain type → wire format). For plain schemas, it validates the response matches
 * the schema. Throws {@link ResponseSerializationError} on failure.
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
  (opts: SerializerCompilerOptions = {}): FastifySerializerCompiler<z.ZodType> =>
  ({ schema, method, url }) =>
  (data: unknown): string => {
    const result = z.safeEncode(schema, data);
    if (!result.success) {
      throw new ResponseSerializationError({
        method,
        url,
        zodError: result.error,
      });
    }
    return JSON.stringify(result.data, opts.replacer);
  };

/**
 * Default serializer compiler using `safeEncode` + `JSON.stringify`.
 *
 * Supports Zod v4 codecs (e.g. `Date` → ISO string) and validates responses
 * against the schema. This is the recommended serializer for most applications.
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(serializerCompiler);
 * ```
 */
export const serializerCompiler: FastifySerializerCompiler<z.ZodType> = createSerializerCompiler();

/**
 * Creates a Fastify serializer compiler that uses Zod's `safeParse` for response validation.
 *
 * Unlike {@link createSerializerCompiler} (which uses `safeEncode`), this skips the codec
 * encode step — ~10-15% faster but does **not** run reverse transforms for codec schemas.
 * Use this when you need response validation but don't use Zod codecs.
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
  (opts: SerializerCompilerOptions = {}): FastifySerializerCompiler<z.ZodType> =>
  ({ schema, method, url }) =>
  (data: unknown): string => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ResponseSerializationError({
        method,
        url,
        zodError: result.error,
      });
    }
    return JSON.stringify(result.data, opts.replacer);
  };

/**
 * Default validating serializer using `safeParse` + `JSON.stringify`.
 *
 * Validates responses but skips codec encoding. ~10-15% faster than
 * {@link serializerCompiler} when codecs are not used.
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(parseSerializerCompiler);
 * ```
 */
export const parseSerializerCompiler: FastifySerializerCompiler<z.ZodType> =
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
  (): FastifySerializerCompiler<z.ZodType> =>
  ({ schema }) => {
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
export const fastSerializerCompiler: FastifySerializerCompiler<z.ZodType> =
  createFastSerializerCompiler();
