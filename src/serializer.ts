import fastJsonStringify from 'fast-json-stringify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import { z } from 'zod';

import { ResponseSerializationError } from './errors.js';

/** Options for the serializer compiler factory. */
export interface SerializerCompilerOptions {
  /** Custom replacer function passed to `JSON.stringify`. */
  replacer?: (key: string, value: unknown) => unknown;
}

/**
 * Creates a Fastify serializer compiler that uses Zod's `safeEncode` for response serialization.
 *
 * For codec schemas, `safeEncode` runs the reverse transform (output → wire format).
 * For plain schemas, it validates that the response matches the schema.
 *
 * @param opts - Optional configuration
 * @returns A Fastify serializer compiler function
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(createSerializerCompiler({ replacer: (k, v) => v }));
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
 * Default serializer compiler instance.
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
 * Unlike `createSerializerCompiler` (which uses `safeEncode`), this skips the codec encode
 * step — ~10-15% faster but does not run reverse transforms for codec schemas.
 * Use this when you need response validation but don't use Zod codecs.
 *
 * @param opts - Optional configuration
 * @returns A Fastify serializer compiler function
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(parseSerializerCompiler);
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
 * Default validating serializer compiler instance.
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
 * Converts the Zod schema to JSON Schema once at route registration, then uses the optimized
 * `fast-json-stringify` function for every request. No Zod validation is performed — responses
 * are serialized directly without type checking.
 *
 * Use this when response validation is not needed and performance is critical.
 * For response validation and codec support, use `createSerializerCompiler` instead.
 *
 * @returns A Fastify serializer compiler function
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(fastSerializerCompiler);
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
 * Default fast serializer compiler instance.
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(fastSerializerCompiler);
 * ```
 */
export const fastSerializerCompiler: FastifySerializerCompiler<z.ZodType> =
  createFastSerializerCompiler();
