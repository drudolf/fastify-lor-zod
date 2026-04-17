import type { z } from 'zod';

import { mapIssueToValidationError } from './map-issue-to-validation-error.js';

describe('Error mapping', () => {
  const makeIssue = (
    overrides: Partial<z.core.$ZodIssueInvalidType> = {},
  ): z.core.$ZodIssueInvalidType => ({
    code: 'invalid_type',
    expected: 'string',
    input: 42,
    path: [],
    message: 'Expected string, received number',
    ...overrides,
  });

  it('maps issue path to instancePath', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['user', 'name'] }), 'body');
    expect(result.instancePath).toBe('/user/name');
  });

  it('produces empty instancePath for root-level issue', () => {
    const result = mapIssueToValidationError(makeIssue({ path: [] }), 'body');
    expect(result.instancePath).toBe('');
  });

  it('includes httpPart in schemaPath', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['name'] }), 'body');
    expect(result.schemaPath).toBe('#/body/name');
  });

  it('omits httpPart from schemaPath when undefined', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['name'] }));
    expect(result.schemaPath).toBe('#/name');
  });

  it('escapes RFC 6901 special characters in path segments', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['a/b', 'c~d', 0] }), 'body');
    expect(result.instancePath).toBe('/a~1b/c~0d/0');
    expect(result.schemaPath).toBe('#/body/a~1b/c~0d/0');
  });

  it('spreads remaining issue properties into params', () => {
    const extras = { minimum: 5, inclusive: true };
    const result = mapIssueToValidationError(
      { ...makeIssue({ expected: 'string', input: 42 }), ...extras },
      'body',
    );
    expect(result.params).toEqual({ expected: 'string', input: 42, minimum: 5, inclusive: true });
  });
});
