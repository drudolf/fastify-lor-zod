import type { z } from 'zod';

import { isZodType, traverseTree } from './schema-tree.js';

/** Result of a single-pass codec/transform scan over a Zod schema tree. */
export interface PipeKinds {
  /** Tree contains a codec pipe (`reverseTransform` present) — requires `safeEncode`. */
  readonly hasCodec: boolean;
  /** Tree contains a one-way transform pipe — cannot be serialized via `safeEncode`. */
  readonly hasTransform: boolean;
}

/**
 * Cache keyed by top-level schema. Relies on Zod schemas being immutable
 * after construction — chaining (`.optional()`, `.nullable()`, …) creates new
 * instances rather than mutating existing ones.
 */
const cache = new WeakMap<z.ZodType, PipeKinds>();

/** Shared result for non-schema inputs — not a valid WeakMap key. */
const NO_KINDS: PipeKinds = Object.freeze({ hasCodec: false, hasTransform: false });

interface MutableKinds {
  hasCodec: boolean;
  hasTransform: boolean;
}

const scan = (schema: z.ZodType, seen: WeakSet<z.ZodType>, kinds: MutableKinds): void => {
  if (!schema?._zod?.def) return;
  if (seen.has(schema)) return;
  seen.add(schema);

  const def = schema._zod.def;
  if (def.type === 'pipe') {
    // A pipe def carrying `reverseTransform` is a codec even when its `out`
    // side is a transform — mirrors the original independent predicates,
    // where the transform predicate explicitly excluded codec defs.
    if ('reverseTransform' in def) kinds.hasCodec = true;
    else if ('out' in def && isZodType(def.out) && def.out._zod.def.type === 'transform')
      kinds.hasTransform = true;
    if (kinds.hasCodec && kinds.hasTransform) return;
  }

  for (const child of traverseTree(schema)) {
    if (isZodType(child)) {
      scan(child, seen, kinds);
      if (kinds.hasCodec && kinds.hasTransform) return;
    }
  }
};

/**
 * Detects codec and one-way transform pipes in a Zod schema tree in a single
 * traversal.
 *
 * Replaces the former separate `hasCodecInTree` / `hasTransformInTree`
 * traversals — one walk, one cache, identical predicate semantics. The walk
 * is bounded by one full traversal and exits early once both kinds are found.
 * Called once per route at compile time; results are cached per schema via
 * `WeakMap` and frozen.
 *
 * @param schema - The Zod schema to inspect
 * @returns Frozen flags indicating which pipe kinds the tree contains
 */
export const pipeKindsInTree = (schema: z.ZodType): PipeKinds => {
  if (!isZodType(schema)) return NO_KINDS;

  const cached = cache.get(schema);
  if (cached !== undefined) return cached;

  const kinds: MutableKinds = { hasCodec: false, hasTransform: false };
  scan(schema, new WeakSet(), kinds);

  const result: PipeKinds = Object.freeze(kinds);
  cache.set(schema, result);
  return result;
};
