---
'fastify-lor-zod': patch
---

Infer `req.body` type from content-type wrapper schemas. Body schemas using `{ content: { 'application/json': { schema: ZodType } } }` now produce a correctly typed union instead of `unknown`.
