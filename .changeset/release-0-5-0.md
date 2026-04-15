---
'fastify-lor-zod': minor
---

### Structural response serializer types

Response schema handler return types are now resolved per-field via structural recursion instead of a single top-level heuristic. Codec fields map to `z.output` (the domain type for `safeEncode`), transform fields map to `z.input` (the parse input for `safeParse`), and `.default()` / `.optional()` fields become optional so Zod can apply defaults during serialization.

**Migration:** Most handlers need no changes. If you relied on the previous whole-schema `z.input`/`z.output` heuristic, per-field resolution may change the expected return type — let TypeScript guide you.

### Features

- **`httpStatus` on `ResponseSerializationError`** — includes the HTTP status code that triggered serialization failure, surfaced in both the error object and its message
- **Custom `replacer` for `createSerializerCompiler`** — pass a `JSON.stringify` replacer function (e.g. for redacting sensitive fields) via `createSerializerCompiler({ replacer })`

### Fixes

- **RFC 6901 JSON Pointer escaping** — validation error `instancePath` and `schemaPath` now escape `~` → `~0` and `/` → `~1` per RFC 6901
- **Pipe traversal for nested codecs** — codecs inside `z.pipe()` (e.g. `z.string().pipe(dateCodec)`) are now discovered by the schema tree walker
- **Non-Zod response schema fallback** — all three serializer compilers (`safeEncode`, `safeParse`, `fast`) now fall back to `JSON.stringify` for non-Zod response schemas (e.g. Fastify description wrappers) instead of throwing
- **Transform detection narrowed** — only actual `ZodTransform` pipes trigger transform-mode serialization; validation pipes like `z.string().pipe(z.string().min(1))` are no longer misclassified
- **Mixed codec+transform guard** — response schemas mixing codec and one-way transform fields are rejected at boot with a clear error instead of failing opaquely at request time
