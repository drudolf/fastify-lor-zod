import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

/** RFC 6901 escape, skipped when the segment has no special characters. */
const escapeSegment = (segment: string): string =>
  segment.indexOf('~') === -1 && segment.indexOf('/') === -1
    ? segment
    : segment.replace(/~/g, '~0').replace(/\//g, '~1');

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
  let pointer = '';
  if (path) {
    for (let i = 0; i < path.length; i++) pointer += `/${escapeSegment(String(path[i]))}`;
  }

  return {
    instancePath: pointer,
    keyword: code,
    message,
    params,
    schemaPath: `#${httpPart ? `/${httpPart}` : ''}${pointer}`,
  };
};
