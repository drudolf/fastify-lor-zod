import type { FastifySchemaValidationError } from 'fastify/types/schema';
import omit from 'lodash-es/omit';
import type { z } from 'zod';

/**
 * Error thrown when response serialization fails.
 *
 * @example
 * ```ts
 * app.setErrorHandler((error, request, reply) => {
 *   if (error instanceof ResponseSerializationError) {
 *     reply.code(500).send({ message: "Response validation failed" });
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
 * @example
 * ```ts
 * app.setErrorHandler((error, request, reply) => {
 *   if (error instanceof RequestValidationError) {
 *     reply.code(400).send({ message: "Validation failed", issues: error.validation });
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
    return issues.map((issue) => ({
      instancePath: RequestValidationError.formatIssuePath(issue.path),
      keyword: issue.code,
      message: issue.message,
      params: { ...omit(issue, ['path', 'code', 'message']) },
      schemaPath: `#/${httpPart}`,
    }));
  }
}
