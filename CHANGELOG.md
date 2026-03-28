# fastify-lor-zod

## 0.1.0-beta.8

### Minor Changes

- [#23](https://github.com/drudolf/fastify-lor-zod/pull/23) [`1a32963`](https://github.com/drudolf/fastify-lor-zod/commit/1a32963b2d2e83d842dedd2fa2016e6576bb329f) Thanks [@drudolf](https://github.com/drudolf)! - Fix serializer type provider to make `.default()` response fields optional

  `FastifyLorZodTypeProvider` previously mapped the serializer to `z.output`, which
  made fields with `.default()` appear as required in handler return types. Handlers
  could not omit defaulted fields without a type error, defeating the purpose of `.default()`.

  The serializer now uses `SerializerType<T>`: `z.input` when output is a subtype of input
  (plain schemas and `.default()` schemas — making defaulted fields optional), falling back
  to `z.output` for codec schemas (where `Date` diverges from `string`) and `z.preprocess`
  schemas (where input is `unknown`).

## 0.1.0-beta.7

### Patch Changes

- [#21](https://github.com/drudolf/fastify-lor-zod/pull/21) [`a4870e2`](https://github.com/drudolf/fastify-lor-zod/commit/a4870e2a418fe2732ec395dbb4fba29c29978eb2) Thanks [@drudolf](https://github.com/drudolf)! - Fix incorrect TypeScript types for `jsonSchemaTransform` and `jsonSchemaTransformObject`. Both functions now correctly declare `SwaggerTransform<Schema>` and `SwaggerTransformObject` return types (imported from `@fastify/swagger`), removing the need for `@ts-expect-error` suppressions when registering the swagger plugin.

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
