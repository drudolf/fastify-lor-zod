import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

import { mapIssueToValidationError } from '../utils/map-issue-to-validation-error.js';

/**
 * Error thrown when response serialization fails.
 *
 * Thrown by `serializerCompiler` and `parseSerializerCompiler` when the handler's
 * return value does not match the response schema. Contains the HTTP method, URL,
 * the underlying `ZodError`, and a Fastify-compatible `validation` array with
 * `schemaPath` entries prefixed `#/body/...` — mirroring `RequestValidationError`.
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
 *     request.log.error({
 *       method: error.method,
 *       url: error.url,
 *       httpStatus: error.httpStatus,
 *       validation: error.validation,       // FastifySchemaValidationError[]
 *       context: error.validationContext,   // always 'body'
 *     });
 *     reply.code(500).send({
 *       error: error.code,         // 'ERR_RESPONSE_SERIALIZATION'
 *       method: error.method,      // 'GET'
 *       url: error.url,            // '/users/42'
 *       httpStatus: error.httpStatus, // '200'
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
  readonly httpStatus: string | undefined;
  readonly zodError: z.ZodError;
  readonly validation: FastifySchemaValidationError[];
  readonly validationContext = 'body' as const;

  constructor(
    options: { method: string; url: string; httpStatus?: string; zodError: z.ZodError },
    errorOptions?: ErrorOptions,
  ) {
    const status = options.httpStatus ? ` (status ${options.httpStatus})` : '';
    super(
      `Response serialization failed for ${options.method} ${options.url}${status}`,
      errorOptions,
    );
    this.method = options.method;
    this.url = options.url;
    this.httpStatus = options.httpStatus;
    this.zodError = options.zodError;
    this.validation = options.zodError.issues.map((issue) =>
      mapIssueToValidationError(issue, 'body'),
    );
  }
}
