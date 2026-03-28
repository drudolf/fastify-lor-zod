import type { z } from 'zod';

/** Duck-type check: is this value a ZodType instance? */
const isZodType = (v: unknown): v is z.ZodType => v != null && typeof v === 'object' && '_zod' in v;

/**
 * Safely read a property from an object, returning only object values.
 * Zod def properties are always null, ZodType, array, or plain object — never primitives.
 */
const get = (obj: object, key: string): object | undefined => {
  if (!(key in obj)) return undefined;
  const v: unknown = (obj as never)[key];
  return v != null && typeof v === 'object' ? v : undefined;
};

/** Push a single schema, spread an array, or spread a plain object's values into `out`. */
const visitNode = (v: object | undefined, out: unknown[]) => {
  if (v == null) return;
  if (isZodType(v)) out.push(v);
  else if (Array.isArray(v)) out.push(...v);
  else out.push(...Object.values(v));
};

/** Gather all potential child values from a Zod schema def. */
const traverseTree = (schema: z.ZodType): unknown[] => {
  const def = schema._zod.def;
  const out: unknown[] = [];

  // object → shape values, array → element, tuple → items + rest
  visitNode(get(def, 'shape'), out);
  visitNode(get(def, 'element'), out);
  visitNode(get(def, 'items'), out);
  visitNode(get(def, 'rest'), out);

  // record/map → keyType + valueType, set → valueType
  visitNode(get(def, 'keyType'), out);
  visitNode(get(def, 'valueType'), out);

  // intersection → left + right, union → options
  visitNode(get(def, 'left'), out);
  visitNode(get(def, 'right'), out);
  visitNode(get(def, 'options'), out);

  // optional/nullable/default/catch/readonly/… → innerType
  visitNode(get(def, 'innerType'), out);

  // lazy → cached innerType on _zod internals
  if (def.type === 'lazy') visitNode(get(schema._zod, 'innerType'), out);

  return out;
};

/**
 * Checks whether a Zod schema tree contains any pipe/codec types
 * that require `safeEncode` for correct serialization.
 *
 * Called once per route at compile time (when Fastify registers the route),
 * not per request. Uses a `WeakSet` to handle circular schemas (e.g. lazy self-refs).
 *
 * @param schema - The Zod schema to inspect
 * @param seen - Internal set for cycle detection
 * @returns `true` if the schema tree contains a pipe or codec
 */
export const hasCodecInTree = (
  schema: z.ZodType,
  seen: WeakSet<z.ZodType> = new WeakSet<z.ZodType>(),
): boolean => {
  if (!schema?._zod?.def) return false;
  if (seen.has(schema)) return false;
  seen.add(schema);

  if (schema._zod.def.type === 'pipe') return true;

  return traverseTree(schema)
    .filter(isZodType)
    .some((child) => hasCodecInTree(child, seen));
};
