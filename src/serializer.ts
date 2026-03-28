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
