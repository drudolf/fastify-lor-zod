import type { FastifySchemaCompiler } from 'fastify';
import type { z } from 'zod';

import { RequestValidationError } from './errors.js';

/**
 * Fastify validator compiler that uses Zod for request validation.
 *
 * Validates body, querystring, params, and headers using `safeParse`.
 * Returns `{ value }` on success, `{ error }` with mapped validation errors on failure.
 *
 * @example
 * ```ts
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
