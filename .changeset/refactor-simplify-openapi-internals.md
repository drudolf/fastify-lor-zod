---
'fastify-lor-zod': patch
---

Internal cleanup: simplify two helpers in the OpenAPI transform layer.

`transformContentTypes` (`src/openapi/schema-transform.ts`) replaces a nested
if/else that duplicated the non-Zod fallback in two places with a single guard
clause, flattening one level of nesting.

`jsonSchemaToOAS30` (`src/openapi/zod-to-openapi.ts`) extracts a small
`recurseRecord(key)` helper to share the previously duplicated recursion over
`properties` and `definitions`.

No behavior change. All public APIs unchanged.
