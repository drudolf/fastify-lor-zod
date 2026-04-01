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
 *     // Do NOT forward error.message or error.zodError to the client —
 *     // they contain internal schema details. Log them server-side instead.
 *     request.log.error({ method: error.method, url: error.url, zodError: error.zodError });
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
    super(`Response serialization failed for ${options.method} ${options.url}`, errorOptions);
    this.method = options.method;
    this.url = options.url;
    this.zodError = options.zodError;
  }
}
