# fastify-lor-zod

## 0.1.0-beta.11

### Patch Changes

- [#31](https://github.com/drudolf/fastify-lor-zod/pull/31) [`e4b9827`](https://github.com/drudolf/fastify-lor-zod/commit/e4b9827c83c80512c70770c9b93dcc356b3e2d8a) Thanks [@drudolf](https://github.com/drudolf)! - Include the field path in `schemaPath` for validation errors.

  Previously `schemaPath` was always `#/{httpPart}` (e.g. `#/body`), regardless of which field failed. It now includes the full issue path: `#/body/user/name`, `#/querystring/page`, etc. `instancePath` is unchanged.

## 0.1.0-beta.10

### Patch Changes

- [#29](https://github.com/drudolf/fastify-lor-zod/pull/29) [`2b0f82a`](https://github.com/drudolf/fastify-lor-zod/commit/2b0f82aea90f321781c9d4fb4106a06a0e666ad2) Thanks [@drudolf](https://github.com/drudolf)! - Fix broken `$ref`s for registered body schemas when `withInputSchema` is `false` (the default).

  Previously, registered schemas used as request bodies always generated `$ref`s pointing to `{Id}Input` components, but those components are only added when `withInputSchema: true`. This produced invalid OpenAPI specs by default.

  Now, `withInputSchema` consistently controls both the component generation and the `$ref` naming: `false` (default) uses the output schema name for all `$ref`s; `true` uses `{Id}Input` for body `$ref`s and adds both variants to `components.schemas`.

## 0.1.0-beta.9

### Minor Changes

- [#26](https://github.com/drudolf/fastify-lor-zod/pull/26) [`af45c2f`](https://github.com/drudolf/fastify-lor-zod/commit/af45c2f2eb67e166362cb294cb139b5059105b93) Thanks [@drudolf](https://github.com/drudolf)! - Add CommonJS output alongside ESM. The package now ships both `dist/index.js` (ESM) and `dist/index.cjs` (CJS), with `"require"` and `"import"` conditions in the `exports` field and a `"main"` field for legacy consumers.

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
