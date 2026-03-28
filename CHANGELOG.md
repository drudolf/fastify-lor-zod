# fastify-lor-zod

## 0.1.0-beta.6

### Patch Changes

- [#15](https://github.com/drudolf/fastify-lor-zod/pull/15) [`c956faa`](https://github.com/drudolf/fastify-lor-zod/commit/c956faa8dcbfec1d8522d0320be645c7bf8a2503) Thanks [@drudolf](https://github.com/drudolf)! - Prevent duplicate npm publish errors on release workflow reruns.

## 0.1.0-beta.5

### Minor Changes

- 773cde9: Initial beta release of fastify-lor-zod.

  - Zod v4 type provider with full type inference for body, params, querystring, headers, and response
  - Three serializer compilers: safeEncode (codec support), safeParse (validation only), fast-json-stringify (no validation)
  - OpenAPI 3.0 and 3.1 schema generation via @fastify/swagger transform
  - Schema registry support with $ref component resolution
  - Custom error classes (RequestValidationError, ResponseSerializationError) with cause chaining
  - Typed plugin helpers (FastifyPluginAsyncZod, FastifyPluginCallbackZod)
  - Fixes issues from fastify-type-provider-zod
