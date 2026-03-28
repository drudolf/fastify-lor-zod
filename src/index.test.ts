import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import get from 'lodash-es/get.js';
import { expectTypeOf } from 'vitest';
import { z } from 'zod';

import { ResponseSerializationError } from './errors.js';
import type { FastifyLorZodTypeProvider, FastifyPluginAsyncZod } from './index.js';
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from './schema-transform.js';
import { serializerCompiler } from './serializer.js';
import { validatorCompiler } from './validator.js';

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
    const spec = app.swagger() as Record<string, unknown>;

    expect(spec.openapi).toBe('3.0.3');
    expect(get(spec, ['info', 'title'])).toBe('Integration Test API');

    // All routes present
    expect(get(spec, ['paths', '/users', 'post'])).toBeDefined();
    expect(get(spec, ['paths', '/users/{id}', 'get'])).toBeDefined();
    expect(get(spec, ['paths', '/health', 'get'])).toBeDefined();

    // Request body schema converted
    const bodySchema = get(spec, [
      'paths',
      '/users',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
    ]) as Record<string, unknown>;
    expect(bodySchema.type).toBe('object');
    expect(bodySchema.properties).toBeDefined();

    // Params and querystring appear as parameters
    const getUserParams = get(spec, ['paths', '/users/{id}', 'get', 'parameters']) as
      | Array<Record<string, unknown>>
      | undefined;
    const paramNames = getUserParams?.map((p) => p.name);
    expect(paramNames).toContain('id');
    expect(paramNames).toContain('fields');

    // Response schemas converted
    const responseSchema = get(spec, [
      'paths',
      '/health',
      'get',
      'responses',
      '200',
      'content',
      'application/json',
      'schema',
    ]) as Record<string, unknown>;
    expect(responseSchema.type).toBe('object');
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
    const body = res.json();
    expect(body.name).toBe('Launch');
    expect(body.startsAt).toBe('2025-01-01T00:00:00.000Z');

    // Swagger spec still generated for codec routes
    const spec = app.swagger() as Record<string, unknown>;
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

    const spec = app.swagger() as Record<string, unknown>;
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
    const body = res.json();
    expect(body.error).toBe('serialization_failed');
    expect(body.code).toBe('ERR_RESPONSE_SERIALIZATION');
    expect(body.method).toBe('GET');
    expect(body.url).toBe('/strict');
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

    app.post(
      '/',
      {
        schema: {
          body: z.object({
            name: z.string(),
            role: z.string().default('user'),
          }),
        },
      },
      (req) => {
        // After validation, default is applied — role is always string
        expectTypeOf(req.body).toEqualTypeOf<{ name: string; role: string }>();
        return req.body;
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
          querystring: z.object({
            ids: z.string().transform((s) => s.split(',')),
          }),
        },
      },
      (req) => {
        // After transform, ids is string[]
        expectTypeOf(req.query).toEqualTypeOf<{ ids: string[] }>();
        return { ids: req.query.ids };
      },
    );

    await app.ready();
  });
});
