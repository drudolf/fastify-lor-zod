import { z } from 'zod';

import { pipeKindsInTree } from './pipe-kinds-in-tree.js';

const dateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso) => new Date(iso),
  encode: (date) => date.toISOString(),
});

describe('Pipe kinds detection', () => {
  it('detects codec-only tree', () => {
    const schema = z.object({ createdAt: dateCodec, name: z.string() });

    expect(pipeKindsInTree(schema)).toEqual({
      hasCodec: true,
      hasTransform: false,
      hasPreprocess: false,
    });
  });

  it('detects transform-only tree', () => {
    const schema = z.object({ value: z.string().transform((s) => s.length) });

    expect(pipeKindsInTree(schema)).toEqual({
      hasCodec: false,
      hasTransform: true,
      hasPreprocess: false,
    });
  });

  it('detects all kinds in a mixed tree in one traversal', () => {
    const schema = z.object({
      createdAt: dateCodec,
      value: z.string().transform((s) => s.length),
      raw: z.preprocess((value) => String(value), z.string()),
      deep: z.object({ another: dateCodec }),
    });

    expect(pipeKindsInTree(schema)).toEqual({
      hasCodec: true,
      hasTransform: true,
      hasPreprocess: true,
    });
  });

  it('returns neither flag for plain trees', () => {
    const schema = z.object({ name: z.string(), age: z.number() });

    expect(pipeKindsInTree(schema)).toEqual({
      hasCodec: false,
      hasTransform: false,
      hasPreprocess: false,
    });
  });

  it('classifies a pipe with both reverseTransform and transform out as codec only', () => {
    // Synthetic pipe def carrying both markers — proves the if/else-if
    // ordering matches the original independent predicates, where
    // `reverseTransform` presence excluded the transform classification.
    const bothMarkers = {
      _zod: {
        def: {
          type: 'pipe',
          reverseTransform: () => undefined,
          in: z.string(),
          out: z.transform((value: string) => value.length),
        },
      },
    } as unknown as z.ZodType;

    expect(pipeKindsInTree(bothMarkers)).toEqual({
      hasCodec: true,
      hasTransform: false,
      hasPreprocess: false,
    });
  });

  it('caches result per schema and returns frozen object', () => {
    const schema = z.object({ createdAt: dateCodec });

    const first = pipeKindsInTree(schema);
    expect(pipeKindsInTree(schema)).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('handles recursive lazy schemas without infinite loop', () => {
    type TreeNode = { children: TreeNode[]; stamp: Date };
    const NodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
      z.object({ children: z.array(NodeSchema), stamp: dateCodec }),
    );

    expect(pipeKindsInTree(NodeSchema)).toEqual({
      hasCodec: true,
      hasTransform: false,
      hasPreprocess: false,
    });
  });

  it('handles non-ZodType input gracefully', () => {
    expect(pipeKindsInTree(undefined as unknown as z.ZodType)).toEqual({
      hasCodec: false,
      hasTransform: false,
      hasPreprocess: false,
    });

    // Malformed children: `_zod` without `def`, and a plain non-Zod object.
    const malformed = {
      _zod: { def: { type: 'object', shape: { missingDef: { _zod: {} }, notZod: {} } } },
    } as unknown as z.ZodType;
    expect(pipeKindsInTree(malformed)).toEqual({
      hasCodec: false,
      hasTransform: false,
      hasPreprocess: false,
    });
  });
  // --- Scaffolded from test-spec.md ---
  it('detects preprocess-only tree', () => {
    const schema = z.object({ v: z.preprocess((value) => String(value).trim(), z.string()) });

    expect(pipeKindsInTree(schema)).toEqual({
      hasCodec: false,
      hasTransform: false,
      hasPreprocess: true,
    });
  });
});
