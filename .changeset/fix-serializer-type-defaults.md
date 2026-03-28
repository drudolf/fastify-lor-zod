---
'fastify-lor-zod': minor
---

Fix serializer type provider to make `.default()` response fields optional

`FastifyLorZodTypeProvider` previously mapped the serializer to `z.output`, which
made fields with `.default()` appear as required in handler return types. Handlers
could not omit defaulted fields without a type error, defeating the purpose of `.default()`.

The serializer now uses `SerializerType<T>`: `z.input` when output is a subtype of input
(plain schemas and `.default()` schemas — making defaulted fields optional), falling back
to `z.output` for codec schemas (where `Date` diverges from `string`) and `z.preprocess`
schemas (where input is `unknown`).
