import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

/**
 * Maps Zod issue objects to Fastify-compatible `FastifySchemaValidationError` entries.
 *
 * @param issues - Array of Zod issue objects from a failed `safeParse`
 * @param httpPart - The HTTP part being validated (`'body'`, `'querystring'`, `'params'`, `'headers'`)
 * @returns Array of `FastifySchemaValidationError` objects with `instancePath`, `keyword`, `message`, `params`, and `schemaPath`
 */
export const mapIssueToValidationError = (
  issues: z.ZodError['issues'][number][],
  httpPart: string | undefined = '',
): FastifySchemaValidationError[] => {
  return issues.map(({ path, code, message, ...params }) => ({
    instancePath: path?.length ? `/${path.join('/')}` : '',
    keyword: code,
    message,
    params,
    schemaPath: `#${httpPart ? `/${httpPart}` : ''}/${path.join('/')}`,
  }));
};
