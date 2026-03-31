import { z } from 'zod';

import { schemaDiverges } from './schema-diverges.js';

const dateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
});

describe('schemaDiverges', () => {
  it('returns false for plain object schema', () => {
    expect(schemaDiverges(z.object({ name: z.string(), age: z.number() }))).toBe(false);
  });

  it('returns true for schema with transform', () => {
    expect(schemaDiverges(z.string().transform((s) => s.toUpperCase()))).toBe(true);
  });

  it('returns false for lazy schema without divergence', () => {
    expect(schemaDiverges(z.lazy(() => z.string()))).toBe(false);
  });

  it('returns true for object with codec field', () => {
    expect(schemaDiverges(z.object({ d: dateCodec }))).toBe(true);
  });

  it('returns true for array of codec elements', () => {
    expect(schemaDiverges(z.array(dateCodec))).toBe(true);
  });

  it('returns true for optional codec', () => {
    expect(schemaDiverges(z.optional(dateCodec))).toBe(true);
  });

  it('returns true for nullable codec', () => {
    expect(schemaDiverges(z.nullable(dateCodec))).toBe(true);
  });

  it('returns true for union with codec variant', () => {
    expect(schemaDiverges(z.union([z.string(), dateCodec]))).toBe(true);
  });

  it('returns true for deeply nested codec', () => {
    expect(schemaDiverges(z.object({ a: z.object({ b: z.object({ c: dateCodec }) }) }))).toBe(true);
  });

  it('returns true for tuple with codec element', () => {
    expect(schemaDiverges(z.tuple([z.string(), dateCodec]))).toBe(true);
  });

  it('returns true for record with codec value', () => {
    expect(schemaDiverges(z.record(z.string(), dateCodec))).toBe(true);
  });

  it('returns true for lazy schema with codec', () => {
    expect(schemaDiverges(z.lazy(() => z.object({ d: dateCodec })))).toBe(true);
  });

  it('returns false for enum schema', () => {
    expect(schemaDiverges(z.enum(['a', 'b', 'c']))).toBe(false);
  });

  it('returns true for intersection with codec side', () => {
    expect(
      schemaDiverges(z.intersection(z.object({ a: z.string() }), z.object({ d: dateCodec }))),
    ).toBe(true);
  });

  it('returns false for intersection without divergence', () => {
    expect(
      schemaDiverges(z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }))),
    ).toBe(false);
  });

  it('returns false for map with codec value (unrepresentable in JSON Schema)', () => {
    expect(schemaDiverges(z.map(z.string(), dateCodec))).toBe(false);
  });

  it('returns false for set with codec element (unrepresentable in JSON Schema)', () => {
    expect(schemaDiverges(z.set(dateCodec))).toBe(false);
  });

  it('returns true for discriminatedUnion with codec variant', () => {
    expect(
      schemaDiverges(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('a'), value: z.string() }),
          z.object({ type: z.literal('b'), value: dateCodec }),
        ]),
      ),
    ).toBe(true);
  });

  it('returns false for plain pipe without transform', () => {
    expect(schemaDiverges(z.string().pipe(z.string()))).toBe(false);
  });

  it('returns false for preprocess', () => {
    expect(schemaDiverges(z.preprocess((v) => String(v), z.string()))).toBe(false);
  });

  it('returns true for object with default field', () => {
    expect(schemaDiverges(z.object({ role: z.string().default('user') }))).toBe(true);
  });

  it('returns true for nested object with default', () => {
    expect(schemaDiverges(z.object({ inner: z.object({ x: z.number().default(0) }) }))).toBe(true);
  });

  it('returns true for optional with default', () => {
    expect(schemaDiverges(z.object({ v: z.string().optional().default('x') }))).toBe(true);
  });

  it('returns false for nullable without default', () => {
    expect(schemaDiverges(z.object({ v: z.string().nullable() }))).toBe(false);
  });

  it('returns false for optional without default', () => {
    expect(schemaDiverges(z.object({ v: z.string().optional() }))).toBe(false);
  });

  it('returns false for plain string', () => {
    expect(schemaDiverges(z.string())).toBe(false);
  });

  it('returns false for array of plain objects', () => {
    expect(schemaDiverges(z.array(z.object({ id: z.number() })))).toBe(false);
  });
});
