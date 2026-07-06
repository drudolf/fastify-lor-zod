---
'fastify-lor-zod': minor
---

perf: ~3x faster validation error construction in the validator compiler

The validator now runs Zod's parser core directly and constructs validation
errors lazily instead of paying classic `ZodError` construction cost (eager
pretty-printed message, per-instance closures) on every failed request.

- The returned error remains ZodError-compatible in every observable way:
  `instanceof z.ZodError`, `instanceof Error`, `.issues`, `.message`,
  `.format()`, `.flatten()`, `.name`, plus the documented `.validation` /
  `.input` augmentation.
- A one-time self-check at module load round-trips a probe schema through the
  fast path and compares it against a `schema.safeParse` baseline; on any
  mismatch the validator falls back to plain `schema.safeParse` and emits a
  process warning.
- The `zod` peer range is now capped to `>=4.4.1 <5` (the fast path relies on
  verified Zod v4 internals).
