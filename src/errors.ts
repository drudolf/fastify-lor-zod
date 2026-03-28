import type { FastifySchemaValidationError } from 'fastify/types/schema';
import type { z } from 'zod';

/**
 * Error thrown when response serialization fails.
 *
 * Thrown by `serializerCompiler` and `parseSerializerCompiler` when the handler's
 * return value does not match the response schema. Contains the HTTP method, URL,
 * and the underlying `ZodError` for inspection.
 *
 * Use `instanceof` to catch in a Fastify error handler. The `code` property
 * (`'ERR_RESPONSE_SERIALIZATION'`) is stable for programmatic matching.
 *
 * @example
 * ```ts
 * app.setErrorHandler((error, request, reply) => {
 *   if (error instanceof ResponseSerializationError) {
 *     reply.code(500).send({
 *       error: error.code,     // 'ERR_RESPONSE_SERIALIZATION'
 *       method: error.method,  // 'GET'
 *       url: error.url,        // '/users/42'
 *     });
 *   }
 * });
 * ```
 */
export class ResponseSerializationError extends Error {
  override readonly name = 'ResponseSerializationError' as const;
  readonly code = 'ERR_RESPONSE_SERIALIZATION' as const;
  readonly method: string;
  readonly url: string;
  readonly zodError: z.ZodError;

  constructor(
    options: { method: string; url: string; zodError: z.ZodError },
    errorOptions?: ErrorOptions,
  ) {
    super(
      `Response serialization failed for ${options.method} ${options.url}: ${options.zodError.message}`,
      errorOptions,
    );
    this.method = options.method;
    this.url = options.url;
    this.zodError = options.zodError;
  }
}

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
    this.validation = RequestValidationError.toValidationError(issues, context);
    this.context = context;
  }

  private static formatIssuePath(path?: PropertyKey[]) {
    return path?.length ? `/${path.join('/')}` : '';
  }

  private static toValidationError(
    issues: z.ZodError['issues'][number][],
    httpPart: string | undefined = '',
  ): FastifySchemaValidationError[] {
    return issues.map(({ path, code, message, ...params }) => ({
      instancePath: RequestValidationError.formatIssuePath(path),
      keyword: code,
      message,
      params,
      schemaPath: `#/${httpPart}`,
    }));
  }
}
