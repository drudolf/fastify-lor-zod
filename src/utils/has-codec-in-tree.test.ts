import { z } from 'zod';

import { hasCodecInTree } from './has-codec-in-tree.js';

const dateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
});

describe('hasCodecInTree', () => {
  it('returns false for plain object schema', () => {
    expect(hasCodecInTree(z.object({ name: z.string(), age: z.number() }))).toBe(false);
  });

  it('returns true for schema with transform (pipe in Zod v4)', () => {
    expect(hasCodecInTree(z.string().transform((s) => s.toUpperCase()))).toBe(true);
  });

  it('returns false for lazy schema without codec', () => {
    expect(hasCodecInTree(z.lazy(() => z.string()))).toBe(false);
  });

  it('returns true for object with codec field', () => {
    expect(hasCodecInTree(z.object({ d: dateCodec }))).toBe(true);
  });

  it('returns true for array of codec elements', () => {
    expect(hasCodecInTree(z.array(dateCodec))).toBe(true);
  });

  it('returns true for optional codec', () => {
    expect(hasCodecInTree(z.optional(dateCodec))).toBe(true);
  });

  it('returns true for nullable codec', () => {
    expect(hasCodecInTree(z.nullable(dateCodec))).toBe(true);
  });

  it('returns true for union with codec variant', () => {
    expect(hasCodecInTree(z.union([z.string(), dateCodec]))).toBe(true);
  });

  it('returns true for deeply nested codec', () => {
    expect(hasCodecInTree(z.object({ a: z.object({ b: z.object({ c: dateCodec }) }) }))).toBe(true);
  });

  it('returns true for tuple with codec element', () => {
    expect(hasCodecInTree(z.tuple([z.string(), dateCodec]))).toBe(true);
  });

  it('returns true for record with codec value', () => {
    expect(hasCodecInTree(z.record(z.string(), dateCodec))).toBe(true);
  });

  it('returns true for lazy schema with codec', () => {
    expect(hasCodecInTree(z.lazy(() => z.object({ d: dateCodec })))).toBe(true);
  });

  it('returns false for enum schema (options are primitives, not schemas)', () => {
    expect(hasCodecInTree(z.enum(['a', 'b', 'c']))).toBe(false);
  });

  it('returns false for non-ZodType input', () => {
    expect(hasCodecInTree({ description: 'not a schema' } as unknown as z.ZodType)).toBe(false);
  });

  it('returns true for intersection with codec side', () => {
    expect(
      hasCodecInTree(z.intersection(z.object({ a: z.string() }), z.object({ d: dateCodec }))),
    ).toBe(true);
  });

  it('returns false for intersection without codec', () => {
    expect(
      hasCodecInTree(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }))),
    ).toBe(false);
  });

  it('handles circular schema without stack overflow', () => {
    type Node = { value: string; child?: Node };
    const nodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({ value: z.string(), child: nodeSchema.optional() }),
    );
    expect(hasCodecInTree(nodeSchema)).toBe(false);
  });
});
