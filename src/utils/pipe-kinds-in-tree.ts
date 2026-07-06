import type { z } from 'zod';

import { isZodType, traverseTree } from './schema-tree.js';

/** Result of a single-pass pipe-kind scan over a Zod schema tree. */
export interface PipeKinds {
  /** Tree contains a codec pipe (`reverseTransform` present) — requires `safeEncode`. */
  readonly hasCodec: boolean;
  /** Tree contains a one-way transform pipe — cannot be serialized via `safeEncode`. */
  readonly hasTransform: boolean;
  /** Tree contains a preprocess pipe (in-side transform) — value changes during parse. */
  readonly hasPreprocess: boolean;
}

/**
 * Cache keyed by top-level schema. Relies on Zod schemas being immutable
 * after construction — chaining (`.optional()`, `.nullable()`, …) creates new
 * instances rather than mutating existing ones.
 */
const cache = new WeakMap<z.ZodType, PipeKinds>();

/** Shared result for non-schema inputs — not a valid WeakMap key. */
const NO_KINDS: PipeKinds = Object.freeze({
  hasCodec: false,
  hasTransform: false,
  hasPreprocess: false,
});

interface MutableKinds {
  hasCodec: boolean;
  hasTransform: boolean;
  hasPreprocess: boolean;
}

const allFound = (kinds: MutableKinds): boolean =>
  kinds.hasCodec && kinds.hasTransform && kinds.hasPreprocess;

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
    // Independent of the codec/transform classification: a pipe can carry an
    // in-side transform in addition to either, and the flag must stay accurate.
    if ('in' in def && isZodType(def.in) && def.in._zod.def.type === 'transform')
      kinds.hasPreprocess = true;
    // Early exit requires all three kinds; two-flag trees now traverse fully —
    // acceptable, this runs once per schema at registration and is cached.
    if (allFound(kinds)) return;
  }

  for (const child of traverseTree(schema)) {
    if (isZodType(child)) {
      scan(child, seen, kinds);
      if (allFound(kinds)) return;
    }
  }
};

/**
 * Detects codec, one-way transform, and preprocess pipes in a Zod schema tree
 * in a single traversal.
 *
 * Replaces the former separate `hasCodecInTree` / `hasTransformInTree`
 * traversals — one walk, one cache. The walk is bounded by one full traversal
 * and exits early once all kinds are found. Called once per route at compile
 * time; results are cached per schema via `WeakMap` and frozen.
 *
 * @param schema - The Zod schema to inspect
 * @returns Frozen flags indicating which pipe kinds the tree contains
 */
export const pipeKindsInTree = (schema: z.ZodType): PipeKinds => {
  if (!isZodType(schema)) return NO_KINDS;

  const cached = cache.get(schema);
  if (cached !== undefined) return cached;

  const kinds: MutableKinds = { hasCodec: false, hasTransform: false, hasPreprocess: false };
  scan(schema, new WeakSet(), kinds);

  const result: PipeKinds = Object.freeze(kinds);
  cache.set(schema, result);
  return result;
};
