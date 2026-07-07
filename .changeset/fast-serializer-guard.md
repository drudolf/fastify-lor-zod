---
'fastify-lor-zod': minor
---

fix: `fastSerializerCompiler` rejects codec, transform, and preprocess response schemas at route registration

**Breaking for affected setups:** apps that register `fastSerializerCompiler`
(globally or per route) together with response schemas containing codecs,
one-way transforms, or preprocess steps now **fail at startup**
(`app.ready()` rejects) instead of booting. Previously these setups silently
emitted wrong JSON — `fast-json-stringify` cannot execute codec encode
functions, transforms, or preprocess steps (e.g. a money codec serialized raw
cents instead of the encoded `"$12.99"` wire format).

**Migration:** switch those routes (or the global serializer) to the default
`serializerCompiler`, which handles codecs via `safeEncode` and transforms via
`safeParse`. There is deliberately no bypass flag.

Unaffected: plain schemas, `.default()` values (applied by
fast-json-stringify), and refinement-only pipes continue to work. `.catch()`
fallbacks were never applied by the fast serializer; an unconvertible value
throws at serialization time.
