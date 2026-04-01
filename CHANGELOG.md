# fastify-lor-zod

## 0.4.3

### Patch Changes

- Re-enable declaration maps (`.d.ts.map`) alongside source files for working IDE "Go to Definition"

## 0.4.2

### Patch Changes

- Ship TypeScript source files for IDE "Go to Definition" support, matching Zod and fastify-type-provider-zod's approach
- Drop declaration maps (`.d.ts.map`) in favor of direct source resolution

## 0.4.1

### Patch Changes

- Export `mapIssueToValidationError` for consumers building custom validator compilers

## 0.4.0

### Breaking Changes

- **`RequestValidationError` is now an interface, not a class.** Use `isRequestValidationError()` type guard instead of `instanceof`. The validator compiler now augments the ZodError directly, eliminating Error constructor overhead.
- `.context` replaced by `.validationContext` (set by Fastify)
- `.code` (`'ERR_REQUEST_VALIDATION'`) removed — Fastify sets `.code` to `'FST_ERR_VALIDATION'`

**Migration:**
```diff
- import { RequestValidationError } from 'fastify-lor-zod';
+ import { isRequestValidationError } from 'fastify-lor-zod';

- if (error instanceof RequestValidationError) {
+ if (isRequestValidationError(error)) {
-   error.context
+   error.validationContext
```

### Performance

- Validation error path now matches turkerdev's end-to-end performance (previously 25% slower)
- Added cold build and error path benchmarks

## 0.3.0

### Minor Changes

- Support Node.js >= 22 (previously required >= 24)

### Patch Changes

- Fix trailing slash in `schemaPath` for root-level validation errors
- Fix OAS 3.0 key stripping — now recurses into `additionalProperties` and `definitions`
- Remove schema details from `ResponseSerializationError.message` (security)
- Improve error messages with `[fastify-lor-zod]` prefix and actionable context
- Remove dead `isObject` utility
- Rename `errors.ts` to `error.ts` in validator and serializer
- Update npm description and keywords for discoverability
- Add Node 22 to CI matrix

## 0.2.2

### Patch Changes

- Exclude test artifacts and declaration maps from published npm package
- Remove README injection from publish script (testing if npm caching was the root cause)

## 0.2.1

### Patch Changes

- Infer `req.body` type from content-type wrapper schemas. Body schemas using `{ content: { 'application/json': { schema: ZodType } } }` now produce a correctly typed union instead of `unknown`.

## 0.2.0

### Minor Changes

- [`0f3ce00`](https://github.com/drudolf/fastify-lor-zod/commit/0f3ce00) ### Features

  - **`RouteHandler` type utility** — define handlers in separate files while preserving full Zod type inference from the schema (`params`, `querystring`, `headers`, `body`, `response`)
  - **`error.input` on `RequestValidationError`** — exposes the original data that failed validation for easier debugging in error handlers
  - **Auto-detect input schema variants** — registered schemas with divergent input/output shapes (transforms, codecs, defaults) automatically get `{Id}Input` components in OpenAPI. The `withInputSchema` option is deprecated.

  ### Fixes

  - Fixed Biome ignoring all files inside git worktrees
  - Fixed missing README on npmjs.com (npm 11+ compatibility)

  ### Docs

  - Simplified OpenAPI/Swagger README section
  - Clarified when `transform` and `transformObject` are needed independently

## 0.1.7

### Patch Changes

- Fix missing README on npmjs.com — inject README content into package.json before publish (npm 11+ workaround)

## 0.1.6

### Patch Changes

- Switch from `pnpm publish` to `npm publish` to include README in registry metadata

## 0.1.5

### Patch Changes

- Auto-detect input schema variants for OpenAPI `{Id}Input` components (deprecates `withInputSchema`)
- Clarify when `transform` and `transformObject` are needed independently
- Fix Biome ignoring all files inside git worktrees

## 0.1.4

### Patch Changes

- [`cbc0013`](https://github.com/drudolf/fastify-lor-zod/commit/cbc0013) Internal improvements: refactor schema tree traversal utilities, simplify validation error mapping, improve test coverage and assertion style, fix CI sync workflow, and update README documentation.

## 0.1.3

### Patch Changes

- [`8de7f18`](https://github.com/drudolf/fastify-lor-zod/commit/8de7f18) Fix sync workflow to auto-resolve version conflicts when syncing releases into develop.

## 0.1.2

### Patch Changes

- [`3c0e28f`](https://github.com/drudolf/fastify-lor-zod/commit/3c0e28f) Add custom changelog generator with clickable commit links, migration guide, and updated benchmark results.

## 0.1.1

### Patch Changes

- 9723915: Add migration guide from fastify-type-provider-zod and update README stability notice for stable release.

## 0.1.0

### Minor Changes

- af45c2f: Add CommonJS output alongside ESM. The package now ships both `dist/index.js` (ESM) and `dist/index.cjs` (CJS), with `"require"` and `"import"` conditions in the `exports` field and a `"main"` field for legacy consumers.
- 1abdd1d: Export `ZodToJsonConfig` from the main entry point.

  Previously consumers who wanted to type the `zodToJsonConfig` option in `SchemaTransformOptions` had to import it from an internal submodule. It is now available directly from `fastify-lor-zod`.

- 1a32963: Fix serializer type provider to make `.default()` response fields optional

  `FastifyLorZodTypeProvider` previously mapped the serializer to `z.output`, which
  made fields with `.default()` appear as required in handler return types. Handlers
  could not omit defaulted fields without a type error, defeating the purpose of `.default()`.

  The serializer now uses `SerializerType<T>`: `z.input` when output is a subtype of input
  (plain schemas and `.default()` schemas — making defaulted fields optional), falling back
  to `z.output` for codec schemas (where `Date` diverges from `string`) and `z.preprocess`
  schemas (where input is `unknown`).

- 773cde9: Initial beta release of fastify-lor-zod.

  - Zod v4 type provider with full type inference for body, params, querystring, headers, and response
  - Three serializer compilers: safeEncode (codec support), safeParse (validation only), fast-json-stringify (no validation)
  - OpenAPI 3.0 and 3.1 schema generation via @fastify/swagger transform
  - Schema registry support with $ref component resolution
  - Custom error classes (RequestValidationError, ResponseSerializationError) with cause chaining
  - Typed plugin helpers (FastifyPluginAsyncZod, FastifyPluginCallbackZod)
  - Fixes issues from fastify-type-provider-zod

### Patch Changes

- 2b0f82a: Fix broken `$ref`s for registered body schemas when `withInputSchema` is `false` (the default).

  Previously, registered schemas used as request bodies always generated `$ref`s pointing to `{Id}Input` components, but those components are only added when `withInputSchema: true`. This produced invalid OpenAPI specs by default.

  Now, `withInputSchema` consistently controls both the component generation and the `$ref` naming: `false` (default) uses the output schema name for all `$ref`s; `true` uses `{Id}Input` for body `$ref`s and adds both variants to `components.schemas`.

- e4b9827: Include the field path in `schemaPath` for validation errors.

  Previously `schemaPath` was always `#/{httpPart}` (e.g. `#/body`), regardless of which field failed. It now includes the full issue path: `#/body/user/name`, `#/querystring/page`, etc. `instancePath` is unchanged.

- a4870e2: Fix incorrect TypeScript types for `jsonSchemaTransform` and `jsonSchemaTransformObject`. Both functions now correctly declare `SwaggerTransform<Schema>` and `SwaggerTransformObject` return types (imported from `@fastify/swagger`), removing the need for `@ts-expect-error` suppressions when registering the swagger plugin.
- c956faa: Prevent duplicate npm publish errors on release workflow reruns.
- 27d9f1b: Fix response description lost when schema resolves to a `$ref`. When using the wrapper syntax `{ description: '...', properties: RegisteredSchema }` where the inner schema is registered, the description now appears at the OpenAPI response object level instead of being discarded. A bare `$ref` is wrapped in `allOf` to comply with OpenAPI 3.0 which forbids sibling keys alongside `$ref`.

## 0.1.0-beta.13

### Patch Changes

- adcd3d1: Fix response description lost when schema resolves to a `$ref`. When using the wrapper syntax `{ description: '...', properties: RegisteredSchema }` where the inner schema is registered, the description now appears at the OpenAPI response object level instead of being discarded. A bare `$ref` is wrapped in `allOf` to comply with OpenAPI 3.0 which forbids sibling keys alongside `$ref`.

## 0.1.0-beta.12

### Minor Changes

- [#33](https://github.com/drudolf/fastify-lor-zod/pull/33) [`9d4d977`](https://github.com/drudolf/fastify-lor-zod/commit/9d4d977c9aa91864e0d3675da112a11c35f22223) Thanks [@drudolf](https://github.com/drudolf)! - Export `ZodToJsonConfig` from the main entry point.

  Previously consumers who wanted to type the `zodToJsonConfig` option in `SchemaTransformOptions` had to import it from an internal submodule. It is now available directly from `fastify-lor-zod`.

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
