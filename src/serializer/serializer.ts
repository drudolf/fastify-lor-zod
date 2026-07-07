import fastJsonStringify from 'fast-json-stringify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import { z } from 'zod';

import { pipeKindsInTree } from '../utils/pipe-kinds-in-tree.js';
import { ResponseSerializationError } from './error.js';

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
  (opts: SerializerCompilerOptions = {}): FastifySerializerCompiler<z.ZodType> =>
  ({ schema, method, url, httpStatus }) => {
    if (!schema?._zod?.def) {
      return (data: unknown): string => JSON.stringify(data, opts.replacer);
    }

    const { hasCodec, hasTransform } = pipeKindsInTree(schema);

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
export const serializerCompiler: FastifySerializerCompiler<z.ZodType> = createSerializerCompiler();

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
  (opts: SerializerCompilerOptions = {}): FastifySerializerCompiler<z.ZodType> =>
  ({ schema, method, url, httpStatus }) => {
    if (!schema?._zod?.def) {
      return (data: unknown): string => JSON.stringify(data, opts.replacer);
    }

    // Zod v4 instance methods are self-bound closures, so the unbound capture
    // is safe — same pattern as `validate` in createSerializerCompiler above.
    const safeParse = schema.safeParse;
    return (data: unknown): string => {
      const result = safeParse(data);
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
export const parseSerializerCompiler: FastifySerializerCompiler<z.ZodType> =
  createParseSerializerCompiler();

/**
 * Creates a Fastify serializer compiler that uses `fast-json-stringify` for maximum performance.
 *
 * Converts the Zod schema to JSON Schema **once** at route registration, then uses the
 * pre-compiled `fast-json-stringify` function for every request. No Zod validation is
 * performed — responses are serialized directly without type checking, the same
 * trade-off vanilla Fastify makes for every response.
 *
 * Schemas containing codecs, one-way transforms, or preprocess steps are
 * **rejected at route registration**: `fast-json-stringify` cannot execute
 * them, so their output would be silently wrong. There is deliberately no
 * bypass — use {@link createSerializerCompiler} for such routes. Schema
 * `.default()` values are applied by `fast-json-stringify`; `.catch()`
 * fallbacks are not — an unconvertible value throws at serialization time
 * instead of being replaced.
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
  ({ schema, method, url }) => {
    if (!schema?._zod?.def) {
      return (data: unknown): string => JSON.stringify(data);
    }

    const { hasCodec, hasTransform, hasPreprocess } = pipeKindsInTree(schema);
    if (hasCodec || hasTransform || hasPreprocess) {
      throw new Error(
        `[fastify-lor-zod] fastSerializerCompiler cannot serialize this response schema: ${method} ${url}. ` +
          'fast-json-stringify executes neither codec encode functions, transforms, nor preprocess steps — ' +
          'output would be silently wrong. Use serializerCompiler for this route or as the global serializer.',
      );
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
 * The fastest option for plain schemas — pre-compiles a JSON Schema stringify
 * function at route registration. No runtime validation is performed on
 * responses; codec, transform, and preprocess schemas are rejected at
 * registration (see {@link createFastSerializerCompiler}).
 *
 * @example
 * ```ts
 * app.setSerializerCompiler(fastSerializerCompiler);
 * ```
 */
export const fastSerializerCompiler: FastifySerializerCompiler<z.ZodType> =
  createFastSerializerCompiler();
