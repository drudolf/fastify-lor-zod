# Benchmarks

Throughput and cold-start benchmarks for `fastify-lor-zod` against the other Fastify + Zod type providers. Reproduce with `pnpm bench` (all providers) or `pnpm bench:lib lor-zod` (this library only).

Providers compared:

- **`fastify-lor-zod`** — this library. `lor-zod` is the default `serializerCompiler`, `lor-zod (parse)` is `parseSerializerCompiler`, and `lor-zod (fast)` is `fastSerializerCompiler`.
- **`type-provider-zod`** — fastify-type-provider-zod 7.0.0
- **`@fastify/type-provider-zod`** — 1.0.0
- **`zod-openapi`** — fastify-zod-openapi 5.6.1

## Serialization throughput

ops/sec, higher is better:

| Scenario | lor-zod | lor-zod (parse) | lor-zod (fast) | type-provider-zod | @fastify/type-provider-zod | zod-openapi |
| -------- | ------- | --------------- | -------------- | ----------------- | -------------------------- | ----------- |
| Simple object | 662K | 658K | 1.22M | 565K | 571K | 597K |
| Simple object + date codec | 338K | Unsupported | Unsupported | 334K | 324K | Unsupported |
| Nested (10 items) | 72K | 72K | 187K | 66K | 64K | 70K |
| Nested + money codec | 62K | Unsupported | Unsupported | 61K | 64K | Unsupported |
| Discriminated union | 1.30M | 1.25M | 1.45M | 1.19M | 1.16M | 829K |
| Recursive tree | 777K | 763K | 2.16M | 659K | 670K | 875K |
| Large array (1000 items) | 1,020 | 1,050 | 2,246 | 978 | 977 | 918 |
| One-way transform in response[^transform] | 2.47M | — | Unsupported | Unsupported | Unsupported | Unsupported |

For non-codec schemas, `serializerCompiler` auto-detects and matches `parseSerializerCompiler` speed. For codec schemas, it automatically uses `safeEncode`.

## Validation throughput — success path

All libraries are closely matched; differences are within run-to-run variance. ops/sec, higher is better:

| Scenario | lor-zod | type-provider-zod | @fastify/type-provider-zod | zod-openapi |
| -------- | ------- | ----------------- | -------------------------- | ----------- |
| Simple object | 843K | 845K | 865K | 844K |
| Nested (10 items) | 122K | 126K | 122K | 125K |
| Discriminated union | 2.15M | 2.06M | 2.07M | 2.04M |
| Recursive tree | 1.52M | 1.53M | 1.52M | 1.48M |
| Headers (loose object)[^coercion] | 3.22M | 3.24M | 3.23M | 3.07M |
| Params (string coercion)[^coercion] | 8.96M | 8.29M | 8.47M | 7.66M |

## Validation throughput — error path

Rejected and retried requests, where lazy error construction pays off. ops/sec, higher is better:

| Scenario | lor-zod | type-provider-zod | @fastify/type-provider-zod | zod-openapi |
| -------- | ------- | ----------------- | -------------------------- | ----------- |
| Single issue | 169K | 149K | 141K | 80K |
| Many nested issues | 41K | 28K | 28K | 9K |
| Discriminated union | 262K | 182K | 170K | 95K |
| Single-value array querystring[^retry] | 222K | 174K | 168K | 68K |

## Cold start — 50 routes

App build, ready, and first OpenAPI spec generation (full startups/sec, higher is better; distinct schemas per route, so schema-keyed caches stay cold):

| Scenario | lor-zod | type-provider-zod | @fastify/type-provider-zod | zod-openapi |
| -------- | ------- | ----------------- | -------------------------- | ----------- |
| 50-route cold start | 85 | 82 | 86 | 64 |

## Environment & reproducibility

Measured on Apple M3 Max, Node.js 24, Zod 4.4.3, against fastify-type-provider-zod 7.0.0, @fastify/type-provider-zod 1.0.0, and fastify-zod-openapi 5.6.1. The error-path advantage reproduces at roughly 1.1--1.5x on Linux x64 and other Apple M-series machines (single-scenario floor 1.08x); the 50-route cold start leads fastify-type-provider-zod on all three machines (1.02--1.11x across runs), with @fastify/type-provider-zod within run variance in both directions.

Reproduce:

- `pnpm bench` — all providers
- `pnpm bench:lib lor-zod` — this library only
- `pnpm bench:memory` — error-path GC / memory profile

[^transform]: One-way transforms in response schemas: fastify-type-provider-zod 7 and @fastify/type-provider-zod throw at request time (`safeEncode` cannot run one-way transforms; upstream [#208](https://github.com/turkerdev/fastify-type-provider-zod/issues/208) regressed in v7), and fastify-zod-openapi rejects the schema at startup. lor-zod detects transforms at compile time and serializes them via `safeParse`; its parse variant shares that code path (not benched separately). The fast variant rejects codec, transform, and preprocess schemas at route registration (`fast-json-stringify` cannot execute them) — hence "Unsupported" in the codec and transform rows.

[^coercion]: lor-zod's headers and params numbers include its single-value array-coercion wrapper ([#151](https://github.com/turkerdev/fastify-type-provider-zod/issues/151)) — a feature the others lack; its overhead is not measurable.

[^retry]: lor-zod parses twice and returns 200 (single values are coerced into arrays, [#151](https://github.com/turkerdev/fastify-type-provider-zod/issues/151)); the others reject with 400 after one parse.
