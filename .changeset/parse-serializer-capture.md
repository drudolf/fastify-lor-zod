---
'fastify-lor-zod': patch
---

perf: resolve `safeParse` once at route registration in `createParseSerializerCompiler`

Consistency cleanup: the parse-mode serializer now captures `schema.safeParse`
at compile time, matching the pattern the default serializer compiler already
uses. Saves a per-request property lookup (~28ns/call, measurable on small
payloads and `z.lazy` schemas). No behavior change for supported usage —
mutating `schema.safeParse` after route registration is not supported, same
as with the default compiler.
