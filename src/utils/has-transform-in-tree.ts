import type { z } from 'zod';

import { createTreePredicate } from './schema-tree.js';

/**
 * Checks whether a Zod schema tree contains any one-way transform pipes.
 *
 * These schemas can be parsed with `safeParse`, but they cannot be serialized
 * via `safeEncode` because they lack a reverse transform.
 *
 * Called once per route at compile time (when Fastify registers the route),
 * not per request. Results are cached per schema via `WeakMap`.
 *
 * @param schema - The Zod schema to inspect
 * @returns `true` if the schema tree contains a non-codec transform pipe
 */
export const hasTransformInTree: (schema: z.ZodType) => boolean = createTreePredicate((schema) => {
  if (schema._zod.def.type !== 'pipe') return false;
  if ('reverseTransform' in schema._zod.def) return false;
  return (schema as z.ZodPipe<z.ZodType, z.ZodType>)._zod.def.out._zod.def.type === 'transform';
});
