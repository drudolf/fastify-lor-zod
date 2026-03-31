import type { z } from 'zod';

/**
 * Recursively strips cosmetic JSON Schema keys that differ between Zod's
 * `io: 'input'` and `io: 'output'` modes without representing a real
 * structural divergence.
 *
 * - `$schema` is always cosmetic (same value for both modes)
 * - `additionalProperties: false` is cosmetic (Zod adds it on output for default-mode objects)
 * - `additionalProperties: { ... }` is semantic (record/catchall value type) and preserved
 */
const stripCosmetic = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(stripCosmetic);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k, v]) => k !== '$schema' && !(k === 'additionalProperties' && v === false))
      .map(([k, v]) => [k, stripCosmetic(v)]),
  );
};

/** Normalizes a Zod schema to a comparable JSON string for the given io mode. */
const normalize = (schema: z.ZodType, io: 'input' | 'output'): string =>
  JSON.stringify(
    stripCosmetic(schema.toJSONSchema({ io, unrepresentable: 'any', reused: 'inline' })),
  );

const cache = new WeakMap<z.ZodType, boolean>();

/**
 * Checks whether a Zod schema produces different JSON Schema representations
 * for input and output modes.
 *
 * Returns `true` when the schema (or any nested child) contains transforms,
 * codecs, or defaults that cause the input shape to differ from the output shape.
 *
 * Used by **OpenAPI** to decide whether a registered schema needs an `{Id}Input` variant.
 *
 * Called once per schema at compile time (OpenAPI generation),
 * not per request. Results are cached per schema via `WeakMap`.
 *
 * @param schema - The Zod schema to inspect
 * @returns `true` if the schema's input and output JSON representations differ
 *
 * @example
 * ```ts
 * schemaDiverges(z.object({ name: z.string() }));
 * // => false (input and output are identical)
 *
 * schemaDiverges(z.object({ role: z.string().default('user') }));
 * // => true (input: role optional, output: role required)
 * ```
 */
export const schemaDiverges = (schema: z.ZodType): boolean => {
  const cached = cache.get(schema);
  if (cached !== undefined) return cached;
  const result = normalize(schema, 'input') !== normalize(schema, 'output');
  cache.set(schema, result);
  return result;
};
