import { expectTypeOf } from 'vitest';

import { isObject } from './isObject.js';

describe('isObject', () => {
  it('returns true for plain object', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isObject(null)).toBe(false);
  });

  it('returns false for array', () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isObject(undefined)).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(true)).toBe(false);
  });

  it('narrows type to Record<string, unknown>', () => {
    const value: unknown = { key: 'value' };
    if (isObject(value)) {
      expectTypeOf(value).toEqualTypeOf<Record<string, unknown>>();
    }
  });
});
