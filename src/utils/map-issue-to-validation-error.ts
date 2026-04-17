import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

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
): FastifySchemaValidationError => {
  const pointer = path?.length
    ? `/${path.map((s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`
    : '';

  return {
    instancePath: pointer,
    keyword: code,
    message,
    params,
    schemaPath: `#${httpPart ? `/${httpPart}` : ''}${pointer}`,
  };
};
