# fastify-lor-zod

[![CI](https://github.com/drudolf/fastify-lor-zod/actions/workflows/ci.yml/badge.svg)](https://github.com/drudolf/fastify-lor-zod/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/fastify-lor-zod.svg)](https://www.npmjs.com/package/fastify-lor-zod)
[![license](https://img.shields.io/npm/l/fastify-lor-zod.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
![beta](https://img.shields.io/badge/status-beta-orange.svg)

> **Beta** -- API may change before 1.0. Feedback and issues welcome.

A Fastify type provider for **Zod v4** with full OpenAPI support.

Built with good vibes for Fastify v5 and Zod v4. Fixes [issues](https://github.com/turkerdev/fastify-type-provider-zod/issues) from [`turkerdev/fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod).

## Why fastify-lor-zod?

- **Zod v4 native** -- uses `safeEncode`, `toJSONSchema`, codecs, and registries directly
- **Three serializer strategies** -- choose between robustness (codec support), validation-only, or raw speed
- **Complete OpenAPI** -- all HTTP parts, nullable types, discriminated unions, recursive schemas, content types
- **Type-safe end-to-end** -- `req.body`, `req.params`, `req.query`, `req.headers`, and `reply.send()` fully typed
- **100% test coverage** -- 106 tests including snapshot parity with `fastify-type-provider-zod`
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
|----------|-----------|--------|-------|----------|
| `serializerCompiler` | Yes | Yes | Baseline | You use `z.codec()` transforms |
| `parseSerializerCompiler` | Yes | No | ~15% faster | You need validation but no codecs |
| `fastSerializerCompiler` | No | No | Fastest | You trust your handlers |

```ts
import {
  serializerCompiler,         // default: z.safeEncode + JSON.stringify
  parseSerializerCompiler,    // z.safeParse + JSON.stringify
  fastSerializerCompiler,     // fast-json-stringify, no validation
} from 'fastify-lor-zod';

app.setSerializerCompiler(serializerCompiler);
```

Each has a factory variant (`createSerializerCompiler`, `createParseSerializerCompiler`, `createFastSerializerCompiler`) that accepts a `replacer` option for `JSON.stringify`.

### Benchmarks

Serialization throughput (ops/sec, higher is better):

| Scenario | lor-zod | lor-zod (parse) | lor-zod (fast) | type-provider-zod | zod-openapi |
|----------|---------|-----------------|----------------|-------------------|-------------|
| Simple object | 245K | 305K | **670K** | 308K | 294K |
| Nested (10 items) | 32K | 36K | **98K** | 36K | 34K |
| Discriminated union | 433K | 540K | **703K** | 505K | 353K |
| Recursive tree | 337K | 392K | **1.12M** | 384K | 462K |

Validation throughput (all libraries are within ~5% of each other):

| Scenario | lor-zod | type-provider-zod | zod-openapi |
|----------|---------|-------------------|-------------|
| Simple object | 376K | 393K | 392K |
| Nested (10 items) | 55K | 57K | 56K |
| Discriminated union | 962K | 937K | 906K |
| Recursive tree | 679K | 716K | 726K |

> Measured on Apple M-series, Node.js 24, Zod 4.3.6. Run `pnpm bench` to reproduce.

## OpenAPI / Swagger

```ts
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from 'fastify-lor-zod';

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

### OpenAPI Features

- OAS 3.0 and 3.1 support
- Automatic `io: "input"` for request schemas, `io: "output"` for response schemas
- `z.registry()` and `z.globalRegistry` resolve to `$ref` components
- Nullable types, discriminated unions, recursive schemas handled correctly
- Nested content types in body and response (`application/json`, `multipart/form-data`, etc.)
- Response `description` preserved from wrapper objects
- `zodToJsonConfig` passthrough for custom `z.toJSONSchema()` options

### Custom Schema Registry

```ts
import { z } from 'zod';
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
} from 'fastify-lor-zod';

const registry = z.registry<{ id: string }>();
const UserSchema = z.object({ id: z.number(), name: z.string() });
registry.add(UserSchema, { id: 'User' });

await app.register(swagger, {
  openapi: { openapi: '3.0.3', info: { title: 'My API', version: '1.0.0' } },
  transform: createJsonSchemaTransform({ schemaRegistry: registry }),
  transformObject: createJsonSchemaTransformObject({ schemaRegistry: registry }),
});
```

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

## Error Handling

Both error classes use modern ES2022+ patterns with `instanceof` support, a stable `code` property for programmatic matching, and `cause` chaining via `ErrorOptions`.

```ts
import {
  RequestValidationError,
  ResponseSerializationError,
} from 'fastify-lor-zod';

app.setErrorHandler((error, request, reply) => {
  if (error instanceof RequestValidationError) {
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
|-----------------|---------|-----|------------------|---------------------|---------|
| 0.1.0-beta.4    | >= 5.8  | >= 4.3 | >= 9.5 (optional) | >= 6.0 (optional, for `fastSerializerCompiler`) | >= 22 |

## Issues Addressed

Fixes issues from [`turkerdev/fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod):

| Issue | Description |
|-------|-------------|
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
|---------|-------------|
| `pnpm test` | Run tests |
| `pnpm test:coverage` | Run tests with 100% coverage enforcement |
| `pnpm check` | Lint + format (Biome) |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm knip` | Detect unused exports and dependencies |
| `pnpm bench` | Run benchmarks against other type providers |
| `pnpm build` | Build ESM output |

Tests follow a spec-first workflow -- see [`test-spec.md`](test-spec.md) for the full test matrix and [`CLAUDE.md`](CLAUDE.md) for project conventions.

## License

MIT
