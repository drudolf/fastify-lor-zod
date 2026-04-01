import type { FastifySchemaCompiler } from 'fastify';
import type { z } from 'zod';

import { mapIssueToValidationError } from './error.js';

/**
 * Fastify validator compiler that uses Zod's `safeParse` for request validation.
 *
 * Validates all HTTP parts (body, querystring, params, headers). On success returns
 * `{ value }` with the parsed data. On failure augments the `ZodError` with
 * `input` and a Fastify-native `validation` array, then returns it. Fastify adds
 * `validationContext` and `statusCode` downstream via `wrapValidationError`.
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
    const result = schema.safeParse(data);
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
