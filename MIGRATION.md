# Migrating from fastify-type-provider-zod

## 1. Install

```bash
pnpm remove fastify-type-provider-zod
pnpm add fastify-lor-zod
```

## 2. Find & replace

Three mechanical renames cover most of the migration:

| Find | Replace |
|------|---------|
| `fastify-type-provider-zod` | `fastify-lor-zod` |
| `ZodTypeProvider` | `FastifyLorZodTypeProvider` |
| `ZodSerializerCompilerOptions` | `SerializerCompilerOptions` |

Everything else keeps the same name: `validatorCompiler`, `serializerCompiler`, `createSerializerCompiler`, `jsonSchemaTransform`, `jsonSchemaTransformObject`, `createJsonSchemaTransform`, `createJsonSchemaTransformObject`, `FastifyPluginCallbackZod`, `FastifyPluginAsyncZod`.

> **New:** `createJsonSchemaTransforms` (plural) is a convenience wrapper that returns both `transform` and `transformObject` in one call — handy when using a custom registry. If you don't use a registry, `jsonSchemaTransform` alone is sufficient (no need for `transformObject`).

## 3. Error handling

The upstream package uses `@fastify/error` constructors with type guard functions. fastify-lor-zod uses a type guard for validation errors and `instanceof` for serialization errors.

### Validation errors

```diff
- import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
+ import { isRequestValidationError } from 'fastify-lor-zod';

  app.setErrorHandler((error, request, reply) => {
-   if (hasZodFastifySchemaValidationErrors(error)) {
-     reply.code(400).send({ error: error.validation });
+   if (isRequestValidationError(error)) {
+     reply.code(400).send({ error: error.validation });
    }
  });
```

`isRequestValidationError(error)` narrows to `RequestValidationError`, which exposes:
- `validation` — `FastifySchemaValidationError[]` (Fastify-native format)
- `validationContext` — `'body' | 'querystring' | 'params' | 'headers'` (set by Fastify)
- `input` — the original data that failed validation

### Serialization errors

```diff
- import { isResponseSerializationError } from 'fastify-type-provider-zod';
+ import { ResponseSerializationError } from 'fastify-lor-zod';

  app.setErrorHandler((error, request, reply) => {
-   if (isResponseSerializationError(error)) {
-     console.error(error.cause.issues);
+   if (error instanceof ResponseSerializationError) {
+     console.error(error.zodError.issues);
    }
  });
```

`ResponseSerializationError` exposes:
- `code` — `'ERR_RESPONSE_SERIALIZATION'`
- `method` — HTTP method
- `url` — request URL
- `httpStatus` — the response status code whose schema failed (e.g. `'200'`)
- `zodError` — the `ZodError` (renamed from `cause`)

## 4. What you get

- **25+ upstream bug fixes** — see the [Appendix: Issues Addressed](#appendix-issues-addressed) table below
- **Codec auto-detect** — the default serializer uses `z.safeEncode` for codec schemas and `z.safeParse` for everything else, chosen at compile time
- **fast-json-stringify option** — `fastSerializerCompiler` for maximum throughput (no validation)
- **Auto-detect input schema variants** — schemas with divergent input/output shapes get `{Id}Input` components automatically
- **Smarter `.default()` typing** — handler return types make defaulted fields optional instead of required
- **No `@fastify/error` dependency** — `ResponseSerializationError` is a standard ES2022+ class; validation errors use a lightweight type guard

## Appendix: Issues Addressed

Fixes 25+ open issues from [`turkerdev/fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod):

| Issue | Description | How |
| ----- | ----------- | --- |
| [#244](https://github.com/turkerdev/fastify-type-provider-zod/issues/244) | params/querystring missing from OpenAPI | Inline via `httpPart` param |
| [#233](https://github.com/turkerdev/fastify-type-provider-zod/issues/233) | Cannot tweak `toJSONSchema` options | `zodToJsonConfig` passthrough |
| [#214](https://github.com/turkerdev/fastify-type-provider-zod/issues/214) | Input schema variants leak into components | Auto-detect divergent schemas |
| [#211](https://github.com/turkerdev/fastify-type-provider-zod/issues/211) | Serializer should use `.encode()` for Zod v4 | Auto-detect codecs, use `safeEncode` |
| [#210](https://github.com/turkerdev/fastify-type-provider-zod/issues/210) | Schema definitions ignored | Merge `external.defs` from `toJSONSchema` |
| [#209](https://github.com/turkerdev/fastify-type-provider-zod/issues/209) | Cannot modify headers after validation | `safeParse` returns unfrozen objects |
| [#208](https://github.com/turkerdev/fastify-type-provider-zod/issues/208) | `transform()` loses response type info | Override falls back to input side of pipe |
| [#195](https://github.com/turkerdev/fastify-type-provider-zod/issues/195) | `anyOf` with 3+ items broken | Native `toJSONSchema` handles correctly |
| [#193](https://github.com/turkerdev/fastify-type-provider-zod/issues/193) | Nullable types converted incorrectly | Native `toJSONSchema` handles correctly |
| [#192](https://github.com/turkerdev/fastify-type-provider-zod/issues/192) | `z.null` in union generates invalid JSON Schema | Native `toJSONSchema` handles correctly |
| [#178](https://github.com/turkerdev/fastify-type-provider-zod/issues/178) | Multi-content schemas not supported | `transformContentTypes` handler |
| [#170](https://github.com/turkerdev/fastify-type-provider-zod/issues/170) | `components.schemas` not populated | `transformObject` with registry resolution |
| [#158](https://github.com/turkerdev/fastify-type-provider-zod/issues/158) | `.default(null)` crashes | Native `toJSONSchema` handles correctly |
| [#156](https://github.com/turkerdev/fastify-type-provider-zod/issues/156) | Support for Zod v4 | Built natively on Zod v4 |
| [#155](https://github.com/turkerdev/fastify-type-provider-zod/issues/155) | `.optional().default()` querystring fails | Native `toJSONSchema` handles correctly |
| [#151](https://github.com/turkerdev/fastify-type-provider-zod/issues/151) | Single-value querystring not counted as array | Auto-coerce single values to arrays for `z.array` schemas |
| [#148](https://github.com/turkerdev/fastify-type-provider-zod/issues/148) | Optional fields treated as required | `SerializerType<T>` makes defaulted fields optional |
| [#142](https://github.com/turkerdev/fastify-type-provider-zod/issues/142) | Cannot separate handler from route preserving types | `RouteHandler<S>` type utility |
| [#132](https://github.com/turkerdev/fastify-type-provider-zod/issues/132) | Body/response content types not handled | `transformContentTypes` handler |
| [#126](https://github.com/turkerdev/fastify-type-provider-zod/issues/126) | No hybrid ESM/CJS bundle | Dual ESM + CJS exports |
| [#124](https://github.com/turkerdev/fastify-type-provider-zod/issues/124) | Type guard doesn't narrow error types | `isRequestValidationError` with full narrowing |
| [#76](https://github.com/turkerdev/fastify-type-provider-zod/issues/76) | 204 response without content | Works with `z.undefined()` |
| [#71](https://github.com/turkerdev/fastify-type-provider-zod/issues/71) | `z.readonly()` not supported | Native `toJSONSchema` handles correctly |
| [#67](https://github.com/turkerdev/fastify-type-provider-zod/issues/67) | Support for `z.readonly()` | Native `toJSONSchema` handles correctly |
| [#64](https://github.com/turkerdev/fastify-type-provider-zod/issues/64) | `instanceof` on validation error fails | ES2022+ `ResponseSerializationError` class |
| [#47](https://github.com/turkerdev/fastify-type-provider-zod/issues/47) | Response description ignored | Description placed on OAS response object, separate from schema |
