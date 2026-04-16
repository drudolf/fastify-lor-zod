import type { FastifySchemaCompiler } from 'fastify';
import type { z } from 'zod';

import { mapIssueToValidationError } from './error.js';

/** HTTP parts where Fastify's parser returns a single string for single-valued inputs (#151). */
const ARRAYABLE_PARTS = new Set(['querystring', 'params', 'headers']);

/**
 * Coerces single-value request inputs into arrays when the schema expects an array (#151).
 *
 * Fastify's default querystring parser returns `"x"` for `?tags=x` but `["x","y"]` for
 * `?tags=x&tags=y`. Users writing `z.array(z.string())` hit a 400 on the single-value case.
 * This helper retries with single values wrapped in arrays, guided by Zod's own issue
 * codes — no schema introspection required.
 *
 * Algorithm: run `safeParse`. If it fails, find issues with `expected: 'array'` at a
 * top-level property path, wrap the non-array input at each such key in `[value]`, and
 * retry once. The second `safeParse` result (success or failure) is final. Only length-1
 * paths are patched — Fastify's default parser produces flat objects, so deeper paths
 * can't originate from real requests. `z.tuple` / `z.set` are deliberately excluded —
 * they report different `expected` values.
 *
 * Scope: coercion applies only to array fields **inside** an object schema. A root-level
 * `z.array(...)` schema (path length 0) is not coerced — unreachable in practice, since
 * Fastify's default parser always yields an object for querystring/params/headers. Unions
 * like `z.union([z.array(...), z.string()])` don't false-coerce either: if any branch
 * matches the incoming value, the first `safeParse` succeeds and coercion never runs.
 */
const coerceSingleToArray = (
  schema: z.ZodType,
  data: unknown,
): ReturnType<z.ZodType['safeParse']> => {
  const first = schema.safeParse(data);
  if (first.success) return first;

  const arrayIssues = first.error.issues.filter(
    (issue) =>
      issue.code === 'invalid_type' &&
      'expected' in issue &&
      issue.expected === 'array' &&
      issue.path.length === 1,
  );
  if (arrayIssues.length === 0) return first;

  const source = data as Record<PropertyKey, unknown>;
  const patched: Record<PropertyKey, unknown> = { ...source };
  for (const issue of arrayIssues) {
    const key = issue.path[0] as PropertyKey;
    patched[key] = [source[key]];
  }

  return schema.safeParse(patched);
};

/**
 * Fastify validator compiler that uses Zod's `safeParse` for request validation.
 *
 * Validates all HTTP parts (body, querystring, params, headers). On success returns
 * `{ value }` with the parsed data. On failure augments the `ZodError` with
 * `input` and a Fastify-native `validation` array, then returns it. Fastify adds
 * `validationContext` and `statusCode` downstream via `wrapValidationError`.
 *
 * For `querystring`, `params`, and `headers`, single-value inputs are automatically
 * coerced into arrays when the schema expects `z.array(...)` — covers the `?tag=a`
 * vs `?tag=a&tag=b` asymmetry in Fastify's default parser (#151).
 *
 * Use {@link isRequestValidationError} in your error handler to detect and access
 * the structured validation details.
 *
 * @returns A Fastify schema compiler function
 *
 * @example
 * ```ts
 * import { validatorCompiler } from 'fastify-lor-zod';
 *
 * app.setValidatorCompiler(validatorCompiler);
 * ```
 */
export const validatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema, httpPart }) =>
  (data: unknown) => {
    const result =
      httpPart !== undefined && ARRAYABLE_PARTS.has(httpPart)
        ? coerceSingleToArray(schema, data)
        : schema.safeParse(data);
    if (!result.success) {
      const error = result.error as z.ZodError & {
        input?: unknown;
        validation?: unknown[];
      };
      error.input = data;
      error.validation = result.error.issues.map((issue) =>
        mapIssueToValidationError(issue, httpPart),
      );
      return { error: error as unknown as Error };
    }
    return { value: result.data };
  };
