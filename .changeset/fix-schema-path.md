---
"fastify-lor-zod": patch
---

Include the field path in `schemaPath` for validation errors.

Previously `schemaPath` was always `#/{httpPart}` (e.g. `#/body`), regardless of which field failed. It now includes the full issue path: `#/body/user/name`, `#/querystring/page`, etc. `instancePath` is unchanged.
