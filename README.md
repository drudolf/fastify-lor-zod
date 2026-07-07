# fastify-lor-zod

[![CI](https://github.com/drudolf/fastify-lor-zod/actions/workflows/ci.yml/badge.svg)](https://github.com/drudolf/fastify-lor-zod/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/fastify-lor-zod.svg)](https://www.npmjs.com/package/fastify-lor-zod)
[![license](https://img.shields.io/npm/l/fastify-lor-zod.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-blue.svg)](https://www.typescriptlang.org/)

> **Note** -- Pre-1.0: minor versions may include breaking changes. Pin your version and check the [changelog](CHANGELOG.md) before upgrading.

A Fastify type provider for **Zod v4** with full OpenAPI support. A ground-up rebuild of [`turkerdev/fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod) on Zod v4's native APIs — fixes [25+ open issues](MIGRATION.md#appendix-issues-addressed).

## Why fastify-lor-zod?

- **Zod v4 native** -- uses `safeEncode`, `toJSONSchema`, codecs, and registries directly
- **Smart serializer** -- auto-detects codecs at compile time; falls back to `safeParse` for ~15% faster non-codec schemas
- **Fast validation errors** -- lazy `ZodError` construction on the error path; 1.1--1.5x faster error responses than alternatives, with a safe automatic fallback
- **Complete OpenAPI** -- all HTTP parts, nullable types, discriminated unions, recursive schemas, content types
- **Type-safe end-to-end** -- `req.body`, `req.params`, `req.query`, `req.headers`, and `reply.send()` fully typed
- **100% test coverage** with snapshot parity against `fastify-type-provider-zod`
- **Why "Lor"?** -- [Son of Zod](https://dc.fandom.com/wiki/Lor-Zod), here to power your `fastify` schemas.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Serializer Compilers](#serializer-compilers)
- [Benchmarks](#benchmarks)
- [OpenAPI / Swagger](#openapi--swagger)
- [Typed Plugins](#typed-plugins)
- [Error Handling](#error-handling)
- [Zod v4 Codec Support](#zod-v4-codec-support)
- [Compatibility](#compatibility)
- [Contributing](#contributing)
- [License](#license)

## Install

```bash
pnpm add fastify-lor-zod
pnpm add -D fastify zod                    # peer dependencies
pnpm add -D @fastify/swagger               # optional, for OpenAPI
```

## Quick Start

```ts
import Fastify from 'fastify';
import { z } from 'zod';
import {
  validatorCompiler,
  serializerCompiler,
  type FastifyLorZodTypeProvider,
} from 'fastify-lor-zod';

const app = Fastify();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.withTypeProvider<FastifyLorZodTypeProvider>().get(
  '/user/:id',
  {
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: z.object({ id: z.number(), name: z.string() }),
      },
    },
  },
  (req) => ({ id: req.params.id, name: 'Alice' }),
  //              ^ fully typed as number
);

app.listen({ port: 3000 });
```

## Serializer Compilers

Three strategies for different trade-offs:

| Compiler | Validates | Codecs | Speed | Use when |
| -------- | --------- | ------ | ----- | -------- |
| `serializerCompiler` | Yes | Auto-detect | Fastest validating | **Recommended default** -- uses `safeParse` for plain schemas, `safeEncode` only when codecs are present |
| `parseSerializerCompiler` | Yes | No | Same as above | Explicit opt-in to always use `safeParse` |
| `fastSerializerCompiler` | No | Rejected at startup | Fastest overall | Escape hatch for plain schemas — no response validation, the same trade-off vanilla Fastify makes; codec, transform, and preprocess schemas are rejected at route registration |

```ts
import {
  serializerCompiler,         // default: auto-detects codecs, picks safeParse or safeEncode
  parseSerializerCompiler,    // always z.safeParse + JSON.stringify
  fastSerializerCompiler,     // fast-json-stringify, no validation
} from 'fastify-lor-zod';

app.setSerializerCompiler(serializerCompiler);
```

`createSerializerCompiler` and `createParseSerializerCompiler` each accept a `replacer` option for `JSON.stringify`. `createFastSerializerCompiler` takes no options — `fast-json-stringify` pre-compiles the serializer at route registration time and does not use `JSON.stringify`. Because `fast-json-stringify` cannot execute codec encode functions, transforms, or preprocess steps, the fast compiler rejects such schemas at route registration instead of silently emitting wrong output (there is deliberately no bypass — use `serializerCompiler` for those routes). Schema `.default()` values are applied; `.catch()` fallbacks are not — an unconvertible value throws at serialization time.

## Benchmarks

- **Fastest on the common shapes** — leads the other validating Zod providers on plain objects and discriminated unions (native `JSON.stringify` beats fast-json-stringify on `anyOf`); stays competitive on the rest.
- **Faster error responses** — lazy error construction makes rejected requests ~1.1--1.5x faster than the next-fastest provider (up to ~4.5x vs zod-openapi), where it counts under load.
- **On par on the success path** — no validation-speed regression to buy the above.
- **Does what others can't** — serializes one-way transforms in responses that fastify-type-provider-zod throws on and fastify-zod-openapi rejects.

Full tables, methodology, and per-scenario numbers: **[bench/BENCHMARK.md](bench/BENCHMARK.md)**.

## OpenAPI / Swagger

Integrate with `@fastify/swagger` for automatic OpenAPI spec generation. `transform` converts Zod schemas per route, `transformObject` populates `components.schemas` from a registry (safe to include even without one):

```ts
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-lor-zod';

await app.register(swagger, {
  openapi: {
    openapi: '3.0.3',
    info: { title: 'My API', version: '1.0.0' },
  },
  transform: jsonSchemaTransform,
  transformObject: jsonSchemaTransformObject,
});

await app.register(swaggerUi, { routePrefix: '/documentation' });
```

- OAS 3.0 and 3.1 support
- Automatic `io: "input"` for request schemas, `io: "output"` for response schemas
- Nullable types, discriminated unions, recursive schemas handled correctly
- Nested content types (`application/json`, `multipart/form-data`, etc.)
- Response `description` preserved from wrapper objects
- `zodToJsonConfig` passthrough for custom `z.toJSONSchema()` options

### Schema Registry

Register schemas with `z.globalRegistry` or a custom registry to generate `$ref`-based `components.schemas`:

```ts
import { z } from 'zod';
import { createJsonSchemaTransforms } from 'fastify-lor-zod';

const registry = z.registry<{ id: string }>();
const UserSchema = z.object({ id: z.number(), name: z.string() });
registry.add(UserSchema, { id: 'User' });

await app.register(swagger, {
  openapi: { openapi: '3.0.3', info: { title: 'My API', version: '1.0.0' } },
  ...createJsonSchemaTransforms({ schemaRegistry: registry }),
});
```

Schemas whose input and output shapes diverge (e.g. due to `.default()`, transforms, or codecs) automatically get `{Id}Input` variants in `components.schemas`. No configuration needed.

## Typed Plugins

```ts
import type { FastifyPluginAsyncZod } from 'fastify-lor-zod';

const usersPlugin: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/users',
    {
      schema: {
        response: { 200: z.array(UserSchema) },
      },
    },
    () => [{ id: 1, name: 'Alice' }],
  );
};

await app.register(usersPlugin);
```

### Typed Handlers

Use `RouteHandler` to define handlers in separate files while preserving Zod type inference:

```ts
import type { RouteHandler } from 'fastify-lor-zod';

const schema = {
  params: z.object({ id: z.coerce.number() }),
  response: { 200: z.object({ name: z.string() }) },
} as const;

const getUser: RouteHandler<typeof schema> = (req) => {
  req.params.id; // number
  return { name: 'Alice' };
};

app.get('/users/:id', { schema }, getUser);
```

## Error Handling

Validation errors are detected with the `isRequestValidationError` type guard. Serialization errors use `instanceof` on the `ResponseSerializationError` class.

Validation errors are built on a fast path that skips stock `ZodError` construction cost, but they stay fully ZodError-compatible: `instanceof z.ZodError`, `.issues`, `.message`, `.format()`, and `.flatten()` all behave as usual. If a future Zod version changes the internals this relies on, the validator falls back to plain `schema.safeParse` at startup and emits a one-time process warning (`[fastify-lor-zod] Zod internals self-check failed ...`) -- behavior stays correct, only error construction gets slower.

```ts
import {
  isRequestValidationError,
  ResponseSerializationError,
} from 'fastify-lor-zod';

app.setErrorHandler((error, request, reply) => {
  if (isRequestValidationError(error)) {
    // Log input server-side only — may contain sensitive fields
    request.log.error({ input: error.input });
    reply.code(400).send({
      error: 'Validation failed',
      issues: error.validation,          // FastifySchemaValidationError[]
      context: error.validationContext,   // 'body' | 'querystring' | 'params' | 'headers'
    });
    return;
  }

  if (error instanceof ResponseSerializationError) {
    reply.code(500).send({
      error: 'Response serialization failed',
      code: error.code,        // 'ERR_RESPONSE_SERIALIZATION'
      method: error.method,    // 'GET'
      url: error.url,          // '/users/42'
      httpStatus: error.httpStatus, // '200'
    });
    return;
  }

  reply.send(error);
});
```

## Zod v4 Codec Support

Zod v4 codecs encode domain types to wire format. The default serializer handles this automatically:

```ts
const dateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso: string) => new Date(iso),
  encode: (date: Date) => date.toISOString(),
});

app.get(
  '/event',
  {
    schema: {
      response: {
        200: z.object({ startsAt: dateCodec }),
      },
    },
  },
  () => ({ startsAt: new Date() }),
  // Response: { "startsAt": "2025-06-15T10:00:00.000Z" }
);
```

## Compatibility

| fastify-lor-zod | Fastify | Zod | @fastify/swagger | fast-json-stringify | Node.js |
| --------------- | ------- | --- | ---------------- | ------------------- | ------- |
| 0.x             | >= 5.7.0 < 6 | >= 4.4.1 < 5 | >= 9.7.0 < 10 (optional) | >= 6.0.0 < 8 (optional, for `fastSerializerCompiler`) | >= 22 |

## Migrating from fastify-type-provider-zod

See [MIGRATION.md](MIGRATION.md) for a step-by-step guide.

## Contributing

```bash
git clone https://github.com/drudolf/fastify-lor-zod.git
cd fastify-lor-zod
pnpm install
```

| Command | Description |
| ------- | ----------- |
| `pnpm test` | Run tests |
| `pnpm test:coverage` | Run tests with 100% coverage enforcement |
| `pnpm check` | Lint + format (Biome) |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm knip` | Detect unused exports and dependencies |
| `pnpm bench` | Run benchmarks against all type providers |
| `pnpm bench:lib <filter>` | Run benchmarks for a single library (e.g. `lor-zod`, `type-provider`, `zod-openapi`) |
| `pnpm build` | Build the project (ESM and CJS) |

Tests follow a spec-first workflow -- see [`test-spec.md`](test-spec.md) for the full test matrix and [`CLAUDE.md`](CLAUDE.md) for project conventions.

## License

MIT
