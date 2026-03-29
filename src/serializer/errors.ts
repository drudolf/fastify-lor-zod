import type z from 'zod';

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
