---
"fastify-lor-zod": patch
---

Fix response description lost when schema resolves to a `$ref`. When using the wrapper syntax `{ description: '...', properties: RegisteredSchema }` where the inner schema is registered, the description now appears at the OpenAPI response object level instead of being discarded. A bare `$ref` is wrapped in `allOf` to comply with OpenAPI 3.0 which forbids sibling keys alongside `$ref`.
