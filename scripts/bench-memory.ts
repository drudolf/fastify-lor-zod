#!/usr/bin/env node

/**
 * GC-pressure comparison for the four validator compilers.
 *
 * Measures GC event count and total GC pause time (via PerformanceObserver)
 * while each validator runs a fixed number of iterations on an error-path
 * payload (many issues — where lazy error construction should reduce
 * allocation pressure) and a valid payload as control.
 *
 * Run with: pnpm bench:memory
 * (builds dist first; requires --expose-gc, wired in the package script)
 *
 * Limitations: GC scheduling is nondeterministic — three interleaved rounds
 * are reported as median with min–max spread; compare only large deltas.
 * This script is intentionally NOT part of `pnpm bench` or CI.
 */

import { validatorCompiler as fastifyOrgValidator } from '@fastify/type-provider-zod';
import { validatorCompiler as turkerValidator } from 'fastify-type-provider-zod';
import { validatorCompiler as samchungyValidator } from 'fastify-zod-openapi';
import { z } from 'zod';

// Built output on purpose: src imports use .js specifiers that node's
// type-stripping cannot resolve; `pnpm bench:memory` builds dist first.
import { validatorCompiler as lorZodValidator } from '../dist/index.js';
import { PerformanceObserver, performance } from 'node:perf_hooks';

const globalGc = (globalThis as { gc?: () => void }).gc;
if (!globalGc) {
  console.error('Run via `pnpm bench:memory` (requires --expose-gc).');
  process.exit(1);
}

const ItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  attributes: z.record(z.string(), z.string()),
});

const OrderSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  items: z.array(ItemSchema),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.number().nonnegative(),
});

const makeItem = (i: number) => ({
  productId: `prod_${i}`,
  quantity: 1 + (i % 3),
  unitPrice: 19.99 + i,
  attributes: { color: 'blue', size: 'M' },
});

const validOrder = {
  orderId: 'ord_1',
  userId: 'usr_1',
  items: Array.from({ length: 10 }, (_, i) => makeItem(i)),
  status: 'confirmed',
  total: 349.9,
};

const invalidOrder = {
  ...validOrder,
  orderId: 123,
  items: validOrder.items.map((item) => ({ ...item, quantity: 'many', unitPrice: 'free' })),
  status: 'teleported',
  total: -1,
};

type Validate = (data: unknown) => unknown;
type Compiler = (args: never) => Validate;

const compilers: Record<string, Compiler> = {
  'fastify-lor-zod': lorZodValidator as Compiler,
  'fastify-type-provider-zod': turkerValidator as Compiler,
  '@fastify/type-provider-zod': fastifyOrgValidator as Compiler,
  'fastify-zod-openapi': samchungyValidator as Compiler,
};

const compilerArgs = { schema: OrderSchema, httpPart: 'body', method: 'POST', url: '/orders' };

const N = 20_000;
const WARMUP = 500;
const ROUNDS = 3;

let gcCount = 0;
let gcTime = 0;
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    gcCount += 1;
    gcTime += entry.duration;
  }
});
observer.observe({ entryTypes: ['gc'] });

// GC perf entries only become visible after an event-loop yield.
const drainGcEntries = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  for (const entry of observer.takeRecords()) {
    gcCount += 1;
    gcTime += entry.duration;
  }
};

let sink: unknown;

interface Cell {
  wallMs: number[];
  gcCount: number[];
  gcMs: number[];
}

const measure = async (
  validate: Validate,
  payload: unknown,
): Promise<{ wall: number; count: number; ms: number }> => {
  for (let i = 0; i < WARMUP; i++) sink = validate(payload);
  globalGc();
  await drainGcEntries();
  gcCount = 0;
  gcTime = 0;

  const start = performance.now();
  for (let i = 0; i < N; i++) sink = validate(payload);
  const wall = performance.now() - start;
  await drainGcEntries();

  return { wall, count: gcCount, ms: gcTime };
};

const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const spread = (values: number[]) =>
  `${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`;

const payloads = {
  'error path': invalidOrder,
  'success path': validOrder,
};

const results = new Map<string, Cell>();
const validators = Object.fromEntries(
  Object.entries(compilers).map(([name, compiler]) => [name, compiler(compilerArgs as never)]),
);

// Interleave rounds across providers so heap drift spreads evenly.
for (let round = 0; round < ROUNDS; round++) {
  for (const [name, validate] of Object.entries(validators)) {
    for (const [path, payload] of Object.entries(payloads)) {
      const key = `${name} | ${path}`;
      const cell = results.get(key) ?? { wallMs: [], gcCount: [], gcMs: [] };
      const { wall, count, ms } = await measure(validate, payload);
      cell.wallMs.push(wall);
      cell.gcCount.push(count);
      cell.gcMs.push(ms);
      results.set(key, cell);
    }
  }
}

console.log(
  `\nGC pressure per ${N.toLocaleString()} validations (median of ${ROUNDS} rounds, min–max in parens)\n`,
);
console.log(
  `${'provider | path'.padEnd(48)}${'wall ms'.padEnd(20)}${'GC events'.padEnd(16)}GC pause ms`,
);
for (const [key, cell] of results) {
  const wall = `${median(cell.wallMs)?.toFixed(0)} (${spread(cell.wallMs)})`;
  const count = `${median(cell.gcCount)}`;
  const ms = `${median(cell.gcMs)?.toFixed(1)} (${spread(cell.gcMs)})`;
  console.log(`${key.padEnd(48)}${wall.padEnd(20)}${count.padEnd(16)}${ms}`);
}
console.log(`\n(sink: ${typeof sink})`);
