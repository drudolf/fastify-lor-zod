import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

/**
 * Error thrown when request validation fails.
 *
 * Thrown by `validatorCompiler` when incoming data (body, querystring, params, headers)
 * does not pass the Zod schema. The `validation` array contains Fastify-compatible
 * validation errors mapped from Zod issues.
 *
 * Use `instanceof` to catch in a Fastify error handler. The `code` property
 * (`'ERR_REQUEST_VALIDATION'`) is stable for programmatic matching. The `input`
 * property contains the raw data that failed validation — be mindful that it may
 * contain sensitive fields; avoid logging it in production without redaction.
 *
 * @example
 * ```ts
 * app.setErrorHandler((error, request, reply) => {
 *   if (error instanceof RequestValidationError) {
 *     reply.code(400).send({
 *       error: error.code,           // 'ERR_REQUEST_VALIDATION'
 *       issues: error.validation,    // FastifySchemaValidationError[]
 *       context: error.context,      // 'body' | 'querystring' | 'params' | 'headers'
 *       input: error.input,          // the original data that failed validation
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
  readonly input: unknown;

  constructor(
    issues: z.ZodError['issues'][number][],
    context: string | undefined,
    input?: unknown,
    errorOptions?: ErrorOptions,
  ) {
    super('Request validation failed', errorOptions);
    this.validation = issues.map((issue) => mapIssueToValidationError(issue, context));
    this.context = context;
    this.input = input;
  }
}

/**
 * Maps Zod issue object to Fastify-compatible `FastifySchemaValidationError` entriy.
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
  schemaPath: `#${httpPart ? `/${httpPart}` : ''}/${path.join('/')}`,
});
