import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import get from 'lodash-es/get.js';
import { expectTypeOf } from 'vitest';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider, FastifyPluginAsyncZod, RouteHandler } from './index.js';
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from './openapi/schema-transform.js';
import { ResponseSerializationError } from './serializer/error.js';
import { serializerCompiler } from './serializer/serializer.js';
import { validatorCompiler } from './validator/validator.js';

/**
 * Builds a full Fastify app with Zod type provider, validator, serializer,
 * and Swagger integration — the way a real consumer would wire things up.
 */
const buildApp = async () => {
  const app = Fastify();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Integration Test API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

describe('integration', () => {
  it('boots, handles requests, and produces a valid OpenAPI spec', async () => {
    const app = await buildApp();

    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.email(),
    });

    // POST /users — request validation + response serialization
    app.post(
      '/users',
      {
        schema: {
          body: z.object({ name: z.string(), email: z.email() }),
          response: { 201: UserSchema },
        },
      },
      (req, reply) => {
        reply.code(201).send({ id: 1, name: req.body.name, email: req.body.email });
      },
    );

    // GET /users/:id — params + querystring + headers + response
    app.get(
      '/users/:id',
      {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          querystring: z.object({ fields: z.string().optional() }),
          headers: z.object({ 'x-api-key': z.string().min(1) }).loose(),
          response: { 200: UserSchema },
        },
      },
      (req) => ({
        id: req.params.id,
        name: 'Alice',
        email: 'alice@example.com',
      }),
    );

    // GET /health — simple route, no request schema
    app.get(
      '/health',
      {
        schema: {
          response: { 200: z.object({ status: z.literal('ok') }) },
        },
      },
      () => ({ status: 'ok' as const }),
    );

    await app.ready();

    // --- Request validation: valid request succeeds ---
    const createRes = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Bob', email: 'bob@example.com' },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json()).toEqual({ id: 1, name: 'Bob', email: 'bob@example.com' });

    // --- Request validation: invalid body returns 400 ---
    const badBodyRes = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 123 },
    });
    expect(badBodyRes.statusCode).toBe(400);

    // --- All HTTP parts validated in single route ---
    const getRes = await app.inject({
      method: 'GET',
      url: '/users/42?fields=name',
      headers: { 'x-api-key': 'secret-key' },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toMatchObject({ id: 42, name: 'Alice' });

    // --- Missing required header returns 400 ---
    const noKeyRes = await app.inject({
      method: 'GET',
      url: '/users/1',
      headers: { 'x-api-key': '' },
    });
    expect(noKeyRes.statusCode).toBe(400);

    // --- Route without request schema works ---
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json()).toEqual({ status: 'ok' });

    // --- Swagger endpoint returns valid OpenAPI spec ---
    const spec = app.swagger();

    expect(spec).toMatchObject({
      openapi: '3.0.3',
      info: { title: 'Integration Test API' },
      paths: {
        '/users': { post: expect.anything() },
        '/users/{id}': { get: expect.anything() },
        '/health': { get: expect.anything() },
      },
    });

    // Request body schema converted
    expect(
      get(spec, [
        'paths',
        '/users',
        'post',
        'requestBody',
        'content',
        'application/json',
        'schema',
      ]),
    ).toMatchObject({ type: 'object', properties: expect.anything() });

    // Params and querystring appear as parameters
    const paramNames = get(spec, ['paths', '/users/{id}', 'get', 'parameters'])?.map(
      (p: Record<string, unknown>) => p.name,
    );
    expect(paramNames).toEqual(expect.arrayContaining(['id', 'fields']));

    // Response schemas converted
    expect(
      get(spec, [
        'paths',
        '/health',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]),
    ).toMatchObject({ type: 'object' });
  });

  it('uses Zod codec encode for response serialization', async () => {
    const app = await buildApp();

    const dateCodec = z.codec(z.iso.datetime(), z.date(), {
      decode: (isoString: string) => new Date(isoString),
      encode: (date: Date) => date.toISOString(),
    });

    app.get(
      '/event',
      {
        schema: {
          response: {
            200: z.object({ name: z.string(), startsAt: dateCodec }),
          },
        },
      },
      () => ({
        name: 'Launch',
        startsAt: new Date('2025-01-01T00:00:00.000Z'),
      }),
    );

    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/event' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      name: 'Launch',
      startsAt: '2025-01-01T00:00:00.000Z',
    });

    // Swagger spec still generated for codec routes
    const spec = app.swagger();
    expect(get(spec, ['paths', '/event', 'get'])).toBeDefined();
  });

  it('registered schemas appear as $ref components in OpenAPI spec', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const registry = z.registry<z.GlobalMeta>();
    const ItemSchema = z.object({ id: z.number(), title: z.string() });
    registry.add(ItemSchema, { id: 'Item' });

    const transform = createJsonSchemaTransform({ schemaRegistry: registry });
    const transformObject = createJsonSchemaTransformObject({ schemaRegistry: registry });

    await app.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: { title: 'Registry Test', version: '1.0.0' },
      },
      transform,
      transformObject,
    });

    const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();

    typedApp.get(
      '/items',
      {
        schema: { response: { 200: z.array(ItemSchema) } },
      },
      () => [{ id: 1, title: 'Widget' }],
    );

    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/items' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 1, title: 'Widget' }]);

    const spec = app.swagger();
    expect(get(spec, ['components', 'schemas', 'Item'])).toBeDefined();
  });

  it('ResponseSerializationError is catchable via custom error handler', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ResponseSerializationError) {
        reply.code(500).send({
          error: 'serialization_failed',
          method: error.method,
          url: error.url,
          code: error.code,
        });
        return;
      }
      reply.send(error);
    });

    const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();

    typedApp.get(
      '/strict',
      {
        schema: {
          response: { 200: z.object({ count: z.number() }) },
        },
      },
      () => ({ count: 'not-a-number' }) as unknown as { count: number },
    );

    const res = await app.inject({ method: 'GET', url: '/strict' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      error: 'serialization_failed',
      code: 'ERR_RESPONSE_SERIALIZATION',
      method: 'GET',
      url: '/strict',
    });
  });

  it('typed plugin works with FastifyPluginAsyncZod', async () => {
    const app = await buildApp();

    const plugin: FastifyPluginAsyncZod = async (instance) => {
      instance.get(
        '/ping',
        {
          schema: {
            response: { 200: z.object({ pong: z.boolean() }) },
          },
        },
        () => ({ pong: true }),
      );
    };

    await app.register(plugin);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pong: true });
  });
});

describe('RouteHandler', () => {
  it('infers types from schema when handler is defined separately', async () => {
    const app = await buildApp();

    const schema = {
      params: z.object({ id: z.coerce.number() }),
      querystring: z.object({ fields: z.string().optional() }),
      headers: z.object({ 'x-api-key': z.string() }).loose(),
      body: z.object({ name: z.string() }),
      response: { 200: z.object({ id: z.number(), name: z.string() }) },
    } as const;

    const handler: RouteHandler<typeof schema> = (req, reply) => {
      expectTypeOf(req.params).toEqualTypeOf<{ id: number }>();
      expectTypeOf(req.query).toEqualTypeOf<{ fields?: string | undefined }>();
      expectTypeOf(req.headers['x-api-key']).toBeString();
      expectTypeOf(req.body).toEqualTypeOf<{ name: string }>();
      expectTypeOf(reply.send).parameter(0).toExtend<{ id: number; name: string } | undefined>();
      return { id: req.params.id, name: req.body.name };
    };

    app.post('/users/:id', { schema }, handler);

    const res = await app.inject({
      method: 'POST',
      url: '/users/42?fields=name',
      headers: { 'x-api-key': 'secret' },
      payload: { name: 'Alice' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 42, name: 'Alice' });
  });
});

describe('type inference', () => {
  const buildApp = () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    return app.withTypeProvider<FastifyLorZodTypeProvider>();
  };

  it('infers body type from Zod schema', async () => {
    const app = buildApp();

    app.post(
      '/',
      {
        schema: {
          body: z.object({ name: z.string(), age: z.number() }),
        },
      },
      (req) => {
        expectTypeOf(req.body).toEqualTypeOf<{ name: string; age: number }>();
        return req.body;
      },
    );

    await app.ready();
  });

  it('infers querystring type from Zod schema', async () => {
    const app = buildApp();

    app.get(
      '/',
      {
        schema: {
          querystring: z.object({ page: z.coerce.number(), q: z.string().optional() }),
        },
      },
      (req) => {
        expectTypeOf(req.query).toEqualTypeOf<{ page: number; q?: string | undefined }>();
        return { page: req.query.page };
      },
    );

    await app.ready();
  });

  it('infers params type from Zod schema', async () => {
    const app = buildApp();

    app.get(
      '/:id',
      {
        schema: {
          params: z.object({ id: z.string() }),
        },
      },
      (req) => {
        expectTypeOf(req.params).toEqualTypeOf<{ id: string }>();
        return { id: req.params.id };
      },
    );

    await app.ready();
  });

  it('infers headers type from Zod schema', async () => {
    const app = buildApp();

    app.get(
      '/',
      {
        schema: {
          headers: z.object({ 'x-api-key': z.string() }),
        },
      },
      (req) => {
        // Headers are typed with the schema output type
        expectTypeOf(req.headers['x-api-key']).toBeString();
        return { ok: true };
      },
    );

    await app.ready();
  });

  it('infers response type for reply.send()', async () => {
    const app = buildApp();

    app.get(
      '/',
      {
        schema: {
          response: {
            200: z.object({ id: z.number(), name: z.string() }),
          },
        },
      },
      (_req, reply) => {
        // reply.send should accept the output type
        reply.send({ id: 1, name: 'Alice' });
      },
    );

    await app.ready();
  });

  it('infers output type for schemas with defaults', async () => {
    const app = buildApp();

    app.get(
      '/',
      {
        schema: {
          response: {
            200: z.object({ name: z.string(), role: z.string().default('user') }),
          },
        },
      },
      (_req, reply) => {
        // role has a default — reply.send should accept it as optional
        expectTypeOf(reply.send)
          .parameter(0)
          .toExtend<{ name: string; role?: string | undefined } | undefined>();
      },
    );

    await app.ready();
  });

  it('infers output type for schemas with transforms', async () => {
    const app = buildApp();

    app.get(
      '/',
      {
        schema: {
          response: {
            200: z.object({ id: z.string().transform((s) => parseInt(s, 10)) }),
          },
        },
      },
      (_req, reply) => {
        // transform produces number — reply.send should accept number for id
        expectTypeOf(reply.send).parameter(0).toExtend<{ id: number }>();
      },
    );

    await app.ready();
  });

  it('Infers output type for response schemas with preprocess', async () => {
    const app = buildApp();

    app.get(
      '/',
      {
        schema: {
          response: {
            200: z.preprocess((v) => String(v), z.string()),
          },
        },
      },
      (_req, reply) => {
        // preprocess has z.input = unknown — SerializerType must resolve to z.output = string, not unknown
        expectTypeOf(reply.send).parameter(0).toExtend<string | undefined>();
      },
    );

    await app.ready();
  });

  it('infers body type from content-type wrapper schema', async () => {
    const app = buildApp();

    app.post(
      '/',
      {
        schema: {
          body: {
            content: {
              'application/json': { schema: z.object({ name: z.string() }) },
              'text/plain': { schema: z.string() },
            },
          },
        },
      },
      (req) => {
        expectTypeOf(req.body).toEqualTypeOf<{ name: string } | string>();
        return { ok: true };
      },
    );

    await app.ready();
  });
});
