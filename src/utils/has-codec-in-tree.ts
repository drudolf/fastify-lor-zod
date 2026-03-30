import type { z } from 'zod';

import { createTreePredicate } from './schema-tree.js';

/**
 * Checks whether a Zod schema tree contains any pipe/codec types
 * that require `safeEncode` for correct serialization.
 *
 * Called once per route at compile time (when Fastify registers the route),
 * not per request. Results are cached per schema via `WeakMap`.
 *
 * @param schema - The Zod schema to inspect
 * @returns `true` if the schema tree contains a pipe or codec
 */
export const hasCodecInTree: (schema: z.ZodType) => boolean = createTreePredicate(
  (schema) => schema._zod.def.type === 'pipe',
);
