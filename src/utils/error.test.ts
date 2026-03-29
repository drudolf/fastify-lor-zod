import type { z } from 'zod';

import { mapIssueToValidationError } from './error.js';

const makeIssue = (
  overrides: Partial<z.ZodError['issues'][number]> = {},
): z.ZodError['issues'][number] =>
  ({
    code: 'invalid_type',
    expected: 'string',
    input: 42,
    path: [],
    message: 'Expected string, received number',
    ...overrides,
  }) as z.ZodError['issues'][number];

describe('Error mapping', () => {
  it('maps issue path to instancePath', () => {
    const [result] = mapIssueToValidationError([makeIssue({ path: ['user', 'name'] })], 'body');
    expect(result.instancePath).toBe('/user/name');
  });

  it('produces empty instancePath for root-level issue', () => {
    const [result] = mapIssueToValidationError([makeIssue({ path: [] })], 'body');
    expect(result.instancePath).toBe('');
  });

  it('includes httpPart in schemaPath', () => {
    const [result] = mapIssueToValidationError([makeIssue({ path: ['name'] })], 'body');
    expect(result.schemaPath).toBe('#/body/name');
  });

  it('omits httpPart from schemaPath when undefined', () => {
    const [result] = mapIssueToValidationError([makeIssue({ path: ['name'] })]);
    expect(result.schemaPath).toBe('#/name');
  });

  it('spreads remaining issue properties into params', () => {
    const [result] = mapIssueToValidationError(
      [makeIssue({ expected: 'string', input: 42 })],
      'body',
    );
    expect(result.params).toMatchObject({ expected: 'string', input: 42 });
  });

  it('maps multiple issues', () => {
    const results = mapIssueToValidationError(
      [makeIssue({ path: ['a'] }), makeIssue({ path: ['b'] })],
      'body',
    );
    expect(results).toHaveLength(2);
    expect(results[0].instancePath).toBe('/a');
    expect(results[1].instancePath).toBe('/b');
  });
});
