import type { FastifySchemaValidationError } from 'fastify';
import type z from 'zod';

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
