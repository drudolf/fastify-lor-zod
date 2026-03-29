import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

import { mapIssueToValidationError } from '../utils/error.js';

/**
 * Error thrown when request validation fails.
 *
 * Thrown by `validatorCompiler` when incoming data (body, querystring, params, headers)
 * does not pass the Zod schema. The `validation` array contains Fastify-compatible
 * validation errors mapped from Zod issues.
 *
 * Use `instanceof` to catch in a Fastify error handler. The `code` property
 * (`'ERR_REQUEST_VALIDATION'`) is stable for programmatic matching.
 *
 * @example
 * ```ts
 * app.setErrorHandler((error, request, reply) => {
 *   if (error instanceof RequestValidationError) {
 *     reply.code(400).send({
 *       error: error.code,           // 'ERR_REQUEST_VALIDATION'
 *       issues: error.validation,    // FastifySchemaValidationError[]
 *       context: error.context,      // 'body' | 'querystring' | 'params' | 'headers'
 *     });
 *   }
 * });
 * ```
 */
export class RequestValidationError extends Error {
  override readonly name = 'RequestValidationError' as const;
  readonly code = 'ERR_REQUEST_VALIDATION' as const;
  readonly validation: FastifySchemaValidationError[];
  readonly context: string | undefined;

  constructor(
    issues: z.ZodError['issues'][number][],
    context: string | undefined,
    errorOptions?: ErrorOptions,
  ) {
    super('Request validation failed', errorOptions);
    this.validation = mapIssueToValidationError(issues, context);
    this.context = context;
  }
}
