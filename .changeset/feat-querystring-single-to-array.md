---
'fastify-lor-zod': minor
---

Auto-coerce single querystring/params/headers values into arrays when the schema expects `z.array(...)` (#151).

Fastify's default querystring parser returns `"a"` for `?tags=a` but `["a","b"]` for `?tags=a&tags=b`. Users writing `z.array(z.string())` hit a 400 on the single-value case. The validator now retries failed parses, wrapping non-array values in `[value]` at paths where Zod reported `expected: 'array'`. Uses Zod's own issue codes as the oracle — no schema tree walking, so wrapper variants (`.optional()`, `.nullable()`, `.default()`, `.min()`) are handled uniformly.

Applied only to `querystring`, `params`, and `headers`. Body is unaffected — JSON payloads are never ambiguous. `z.tuple` and `z.set` are deliberately excluded; they emit different `expected` values.

**Behavior change:** requests that previously returned 400 for single-value array querystrings now succeed. If any downstream code relied on that 400, it will need updating.
