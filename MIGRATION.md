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

- **19+ upstream bug fixes** — see the [Issues Addressed](README.md#issues-addressed) table
- **Codec auto-detect** — the default serializer uses `z.safeEncode` for codec schemas and `z.safeParse` for everything else, chosen at compile time
- **fast-json-stringify option** — `fastSerializerCompiler` for maximum throughput (no validation)
- **Auto-detect input schema variants** — schemas with divergent input/output shapes get `{Id}Input` components automatically
- **Smarter `.default()` typing** — handler return types make defaulted fields optional instead of required
- **No `@fastify/error` dependency** — `ResponseSerializationError` is a standard ES2022+ class; validation errors use a lightweight type guard
