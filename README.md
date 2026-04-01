# fastify-lor-zod

[![CI](https://github.com/drudolf/fastify-lor-zod/actions/workflows/ci.yml/badge.svg)](https://github.com/drudolf/fastify-lor-zod/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/fastify-lor-zod.svg)](https://www.npmjs.com/package/fastify-lor-zod)
[![license](https://img.shields.io/npm/l/fastify-lor-zod.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-blue.svg)](https://www.typescriptlang.org/)

> **Note** -- Pre-1.0: minor versions may include breaking changes. Pin your version and check the [changelog](CHANGELOG.md) before upgrading.

A Fastify type provider for **Zod v4** with full OpenAPI support.

Built with good vibes for Fastify v5 and Zod v4. Fixes [issues](https://github.com/turkerdev/fastify-type-provider-zod/issues) from [`turkerdev/fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod).

## Why fastify-lor-zod?

- **Zod v4 native** -- uses `safeEncode`, `toJSONSchema`, codecs, and registries directly
- **Smart serializer** -- auto-detects codecs at compile time; falls back to `safeParse` for ~15% faster non-codec schemas
- **Complete OpenAPI** -- all HTTP parts, nullable types, discriminated unions, recursive schemas, content types
- **Type-safe end-to-end** -- `req.body`, `req.params`, `req.query`, `req.headers`, and `reply.send()` fully typed
- **100% test coverage** -- 127 tests including snapshot parity with `fastify-type-provider-zod`
- **Why "Lor"?** -- [Son of Zod](https://dc.fandom.com/wiki/Lor-Zod), here to power your `fastify` schemas.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Serializer Compilers](#serializer-compilers)
- [OpenAPI / Swagger](#openapi--swagger)
- [Typed Plugins](#typed-plugins)
- [Error Handling](#error-handling)
- [Zod v4 Codec Support](#zod-v4-codec-support)
- [Compatibility](#compatibility)
- [Issues Addressed](#issues-addressed)
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
| `fastSerializerCompiler` | No | No | Fastest overall | You trust your handlers and want maximum throughput |

```ts
import {
  serializerCompiler,         // default: auto-detects codecs, picks safeParse or safeEncode
  parseSerializerCompiler,    // always z.safeParse + JSON.stringify
  fastSerializerCompiler,     // fast-json-stringify, no validation
} from 'fastify-lor-zod';

app.setSerializerCompiler(serializerCompiler);
```

`createSerializerCompiler` and `createParseSerializerCompiler` each accept a `replacer` option for `JSON.stringify`. `createFastSerializerCompiler` takes no options — `fast-json-stringify` pre-compiles the serializer at route registration time and does not use `JSON.stringify`.

### Benchmarks

Serialization throughput (ops/sec, higher is better):

| Scenario | lor-zod | lor-zod (parse) | lor-zod (fast) | type-provider-zod | zod-openapi |
| -------- | ------- | --------------- | -------------- | ----------------- | ----------- |
| Simple object | 278K | 287K | 610K | 291K | 271K |
| Simple object + date codec | 142K | Unsupported | 211K | Unsupported | Unsupported |
| Nested (10 items) | 33K | 34K | 86K | 34K | 30K |
| Nested + money codec | 29K | Unsupported | 90K | Unsupported | Unsupported |
| Discriminated union | 499K | 487K | 651K | 505K | 316K |
| Recursive tree | 407K | 383K | 1.13M | 397K | 438K |

For non-codec schemas, `serializerCompiler` auto-detects and matches `parseSerializerCompiler` speed. For codec schemas, it automatically uses `safeEncode`.

Validation throughput (all libraries are within ~5% of each other):

| Scenario | lor-zod | type-provider-zod | zod-openapi |
| -------- | ------- | ----------------- | ----------- |
| Simple object | 386K | 360K | 366K |
| Nested (10 items) | 57K | 57K | 58K |
| Discriminated union | 996K | 946K | 933K |
| Recursive tree | 819K | 805K | 758K |

> Measured on Apple M-series, Node.js 24, Zod 4.3.6. Run `pnpm bench` to reproduce, or `pnpm bench:lib lor-zod` for this library only.

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

Both error classes use modern ES2022+ patterns with `instanceof` support, a stable `code` property for programmatic matching, and `cause` chaining via `ErrorOptions`.

```ts
import {
  RequestValidationError,
  ResponseSerializationError,
} from 'fastify-lor-zod';

app.setErrorHandler((error, request, reply) => {
  if (error instanceof RequestValidationError) {
    // Log input server-side only — may contain sensitive fields
    request.log.error({ input: error.input, context: error.context });
    reply.code(400).send({
      error: 'Validation failed',
      issues: error.validation,
    });
    return;
  }

  if (error instanceof ResponseSerializationError) {
    reply.code(500).send({
      error: 'Response serialization failed',
      code: error.code,    // 'ERR_RESPONSE_SERIALIZATION'
      method: error.method,
      url: error.url,
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
| 0.x             | >= 5.8.4 | >= 4.3.6 | >= 9.7.0 (optional) | >= 6.3.0 (optional, for `fastSerializerCompiler`) | >= 24 |

## Migrating from fastify-type-provider-zod

See [MIGRATION.md](MIGRATION.md) for a step-by-step guide.

## Issues Addressed

Fixes issues from [`turkerdev/fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod):

| Issue | Description |
| ----- | ----------- |
| [#244](https://github.com/turkerdev/fastify-type-provider-zod/issues/244) | params/querystring missing from OpenAPI |
| [#233](https://github.com/turkerdev/fastify-type-provider-zod/issues/233) | Cannot tweak `toJSONSchema` options |
| [#214](https://github.com/turkerdev/fastify-type-provider-zod/issues/214) | Input schema variants leak into components |
| [#211](https://github.com/turkerdev/fastify-type-provider-zod/issues/211) | Serializer should use `.encode()` for Zod v4 |
| [#210](https://github.com/turkerdev/fastify-type-provider-zod/issues/210) | Schema definitions ignored |
| [#209](https://github.com/turkerdev/fastify-type-provider-zod/issues/209) | Cannot modify headers after validation |
| [#208](https://github.com/turkerdev/fastify-type-provider-zod/issues/208) | `transform()` loses response type info |
| [#195](https://github.com/turkerdev/fastify-type-provider-zod/issues/195) | `anyOf` with 3+ items broken |
| [#193](https://github.com/turkerdev/fastify-type-provider-zod/issues/193) | Nullable types converted incorrectly |
| [#192](https://github.com/turkerdev/fastify-type-provider-zod/issues/192) | `z.null` in union generates invalid JSON Schema |
| [#178](https://github.com/turkerdev/fastify-type-provider-zod/issues/178) | Multi-content schemas not supported |
| [#170](https://github.com/turkerdev/fastify-type-provider-zod/issues/170) | `components.schemas` not populated |
| [#158](https://github.com/turkerdev/fastify-type-provider-zod/issues/158) | `.default(null)` crashes |
| [#155](https://github.com/turkerdev/fastify-type-provider-zod/issues/155) | `.optional().default()` querystring fails |
| [#148](https://github.com/turkerdev/fastify-type-provider-zod/issues/148) | Optional fields treated as required |
| [#132](https://github.com/turkerdev/fastify-type-provider-zod/issues/132) | Body/response content types not handled |
| [#71](https://github.com/turkerdev/fastify-type-provider-zod/issues/71) | `z.readonly()` not supported |
| [#47](https://github.com/turkerdev/fastify-type-provider-zod/issues/47) | Response description ignored |

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
