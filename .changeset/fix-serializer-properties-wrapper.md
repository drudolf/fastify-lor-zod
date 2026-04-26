---
'fastify-lor-zod': patch
---

Fix silent skip of response validation when the route declares its response
schema with the `{ description, properties: ZodType }` wrapper form (used to
attach OAS metadata at the route level).

Previously, `serializerCompiler`, `parseSerializerCompiler`, and
`fastSerializerCompiler` checked for `_zod.def` directly on the wrapper object,
found nothing, and fell through to bare `JSON.stringify(data)` — producing
no validation, no codec encoding, and no field stripping. The OpenAPI doc
generation already supported this wrapper form, so the bug was silent: docs
looked correct but responses were not validated.

All three serializer compilers now unwrap `{ properties: ZodType }` before
inspecting the schema, matching upstream `fastify-type-provider-zod` parity.
Their public types widen from `FastifySerializerCompiler<z.ZodType>` to
`FastifySerializerCompiler<z.ZodType | { properties: z.ZodType }>`.
