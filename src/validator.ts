import type { FastifySchemaCompiler } from 'fastify';
import type { z } from 'zod';

import { RequestValidationError } from './errors.js';

/**
 * Fastify validator compiler that uses Zod's `safeParse` for request validation.
 *
 * Validates all HTTP parts (body, querystring, params, headers). On success returns
 * `{ value }` with the parsed data. On failure returns `{ error }` with a
 * {@link RequestValidationError} containing Fastify-compatible validation errors.
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
      return { error: new RequestValidationError(result.error.issues, httpPart) };
    }
    return { value: result.data };
  };
