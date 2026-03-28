---
"fastify-lor-zod": minor
---

Initial beta release of fastify-lor-zod.

- Zod v4 type provider with full type inference for body, params, querystring, headers, and response
- Three serializer compilers: safeEncode (codec support), safeParse (validation only), fast-json-stringify (no validation)
- OpenAPI 3.0 and 3.1 schema generation via @fastify/swagger transform
- Schema registry support with $ref component resolution
- Custom error classes (RequestValidationError, ResponseSerializationError) with cause chaining
- Typed plugin helpers (FastifyPluginAsyncZod, FastifyPluginCallbackZod)
- Fixes 18 upstream issues from fastify-type-provider-zod
