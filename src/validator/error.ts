import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

/**
 * Shape of validation error details augmented onto the ZodError by the validator compiler.
 *
 * The `validation` array contains Fastify-compatible errors mapped from Zod issues.
 * The `validationContext` identifies the HTTP part that failed (set by Fastify).
 * The `input` holds the raw data that failed validation.
 *
 * Use {@link isRequestValidationError} to detect in a Fastify error handler.
 *
 * The `input` property may contain sensitive fields (passwords, tokens) —
 * avoid logging it in production without redaction.
 */
export interface RequestValidationError extends Error {
  readonly validation: FastifySchemaValidationError[];
  readonly validationContext: string;
  readonly input: unknown;
}

/**
 * Type guard for request validation errors produced by `validatorCompiler`.
 *
 * @param error - The error from a Fastify error handler
 * @returns `true` if the error is an augmented ZodError with validation details
 *
 * @example
 * ```ts
 * app.setErrorHandler((error, request, reply) => {
 *   if (isRequestValidationError(error)) {
 *     // Log input server-side only — it may contain sensitive fields (passwords, tokens)
 *     request.log.error({ input: error.input });
 *     reply.code(400).send({
 *       error: 'Validation failed',
 *       issues: error.validation,          // FastifySchemaValidationError[]
 *       context: error.validationContext,   // 'body' | 'querystring' | 'params' | 'headers'
 *     });
 *   }
 * });
 * ```
 */
export const isRequestValidationError = (error: unknown): error is RequestValidationError =>
  error instanceof Error && 'validation' in error && 'input' in error;

/**
 * Maps Zod issue object to Fastify-compatible `FastifySchemaValidationError` entry.
 *
 * @param issue - Zod issue object from a failed `safeParse`
 * @param httpPart - The HTTP part being validated (`'body'`, `'querystring'`, `'params'`, `'headers'`)
 * @returns `FastifySchemaValidationError` object with `instancePath`, `keyword`, `message`, `params`, and `schemaPath`
 */
export const mapIssueToValidationError = (
  { path, code, message, ...params }: z.ZodError['issues'][number],
  httpPart?: string,
): FastifySchemaValidationError => ({
  instancePath: path?.length ? `/${path.join('/')}` : '',
  keyword: code,
  message,
  params,
  schemaPath: `#${httpPart ? `/${httpPart}` : ''}${path?.length ? `/${path.join('/')}` : ''}`,
});
