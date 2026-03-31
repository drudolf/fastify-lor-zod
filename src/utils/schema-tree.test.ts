import { z } from 'zod';

import { createTreePredicate } from './schema-tree.js';

const isPipe = (schema: z.ZodType) => schema._zod.def.type === 'pipe';

describe('createTreePredicate', () => {
  it('returns cached result from WeakMap', () => {
    let callCount = 0;
    const predicate = createTreePredicate((schema) => {
      callCount++;
      return schema._zod.def.type === 'pipe';
    });

    const schema = z.object({ name: z.string() });
    predicate(schema);
    predicate(schema);

    // Predicate is called once per unique schema node on the first traversal,
    // but the second call returns from cache without calling the predicate again
    const firstCallCount = callCount;
    predicate(schema);
    expect(callCount).toBe(firstCallCount);
  });

  it('independent predicates do not share cache', () => {
    const hasPipe = createTreePredicate(isPipe);
    const hasDefault = createTreePredicate((schema) => schema._zod.def.type === 'default');

    const schema = z.object({ name: z.string().default('anon') });

    expect(hasPipe(schema)).toBe(false);
    expect(hasDefault(schema)).toBe(true);
  });

  it('findInTree handles non-ZodType input gracefully', () => {
    const hasPipe = createTreePredicate(isPipe);
    expect(hasPipe({ description: 'not a schema' } as unknown as z.ZodType)).toBe(false);
  });
});
