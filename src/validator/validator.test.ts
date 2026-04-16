import Fastify from 'fastify';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from '../index.js';
import { serializerCompiler } from '../serializer/serializer.js';
import { isRequestValidationError } from './error.js';
import { validatorCompiler } from './validator.js';

const buildApp = () => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

describe('validator', () => {
  describe('request validation', () => {
    it('accepts valid querystring parameters', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            querystring: z.object({ name: z.string() }),
          },
        },
        (req) => ({ name: req.query.name }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/?name=hello',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ name: 'hello' });
    });

    it('accepts requests on routes without schema', async () => {
      const app = buildApp();
      app.get('/', () => ({ ok: true }));

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });

    it('returns 400 on querystring validation error', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            querystring: z.object({ count: z.coerce.number().int() }),
          },
        },
        (req) => ({ count: req.query.count }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/?count=notanumber',
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 on body validation error', async () => {
      const app = buildApp();
      app.post(
        '/',
        {
          schema: {
            body: z.object({ email: z.email() }),
          },
        },
        (req) => ({ email: req.body.email }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { email: 'not-an-email' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 on empty body validation error', async () => {
      const app = buildApp();
      app.post(
        '/',
        {
          schema: {
            body: z.object({ name: z.string() }),
          },
        },
        (req) => ({ name: req.body.name }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('validates headers', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            headers: z.object({ 'x-api-key': z.string().min(1) }).loose(),
          },
        },
        (req) => ({ key: req.headers['x-api-key'] }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-api-key': 'secret' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ key: 'secret' });
    });

    it('validates params', async () => {
      const app = buildApp();
      app.get(
        '/:id',
        {
          schema: {
            params: z.object({ id: z.string().min(1) }),
          },
        },
        (req) => ({ id: req.params.id }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/123',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: '123' });
    });
  });

  describe('direct compiler invocation', () => {
    it('uses undefined as httpPart fallback when not provided', () => {
      const validate = validatorCompiler({
        schema: z.object({ name: z.string() }),
        httpPart: undefined,
        url: '/',
        method: 'GET',
      });

      const result = validate({ name: 123 });
      expect(result).toMatchObject({
        error: expect.objectContaining({
          validation: [expect.objectContaining({ schemaPath: '#/name' })],
        }),
      });
    });
  });

  describe('input reporting', () => {
    it('exposes original input on validation error', async () => {
      let caughtError: unknown;
      const app = buildApp();
      app.setErrorHandler((error, _req, reply) => {
        caughtError = error;
        reply.code(400).send({ statusCode: 400 });
      });
      app.post(
        '/',
        {
          schema: {
            body: z.object({ email: z.email() }),
          },
        },
        (req) => ({ email: req.body.email }),
      );

      const payload = { email: 'not-an-email' };
      await app.inject({
        method: 'POST',
        url: '/',
        payload,
      });

      expect(isRequestValidationError(caughtError)).toBe(true);
      if (isRequestValidationError(caughtError)) {
        expect(caughtError.input).toEqual(payload);
      }
    });
  });

  describe('post-validation behavior', () => {
    it('headers can be modified after validation (#209)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            headers: z.object({ 'x-request-id': z.string() }).loose(),
          },
        },
        (req, reply) => {
          // Modify a header after validation — should not throw
          reply.header('x-response-id', req.headers['x-request-id']);
          return { ok: true };
        },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-request-id': 'abc-123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-response-id']).toBe('abc-123');
    });
  });
  describe('single-to-array coercion (#151)', () => {
    it('Coerces single querystring value into array for z.array schema (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ tags: z.array(z.string()) }) },
        },
        (req) => ({ tags: req.query.tags }),
      );

      const response = await app.inject({ method: 'GET', url: '/?tags=apple' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['apple'] });
    });

    it('Already-array querystring passes through unchanged (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ tags: z.array(z.string()) }) },
        },
        (req) => ({ tags: req.query.tags }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/?tags=apple&tags=peach',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['apple', 'peach'] });
    });

    it('Coerces single value with optional array schema (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ tags: z.array(z.string()).optional() }) },
        },
        (req) => ({ tags: req.query.tags ?? null }),
      );

      const response = await app.inject({ method: 'GET', url: '/?tags=apple' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['apple'] });
    });

    it('Coerces single value with nullable array schema (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ tags: z.array(z.string()).nullable() }) },
        },
        (req) => ({ tags: req.query.tags }),
      );

      const response = await app.inject({ method: 'GET', url: '/?tags=apple' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['apple'] });
    });

    it('Coerces single value with defaulted array schema (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ tags: z.array(z.string()).default([]) }) },
        },
        (req) => ({ tags: req.query.tags }),
      );

      const response = await app.inject({ method: 'GET', url: '/?tags=apple' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['apple'] });
    });

    it('Coerces single value with refined array min length (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ tags: z.array(z.string()).min(1) }) },
        },
        (req) => ({ tags: req.query.tags }),
      );

      const response = await app.inject({ method: 'GET', url: '/?tags=apple' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['apple'] });
    });

    it('Coerces single value through element coercion (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ counts: z.array(z.coerce.number()) }) },
        },
        (req) => ({ counts: req.query.counts }),
      );

      const response = await app.inject({ method: 'GET', url: '/?counts=42' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ counts: [42] });
    });

    it('Coerces multiple single-value array fields in one request (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            querystring: z.object({
              tags: z.array(z.string()),
              ids: z.array(z.string()),
            }),
          },
        },
        (req) => ({ tags: req.query.tags, ids: req.query.ids }),
      );

      const response = await app.inject({ method: 'GET', url: '/?tags=a&ids=b' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ tags: ['a'], ids: ['b'] });
    });

    it('Does not coerce when schema expects non-array (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: { querystring: z.object({ name: z.string() }) },
        },
        (req) => ({ name: req.query.name }),
      );

      const response = await app.inject({ method: 'GET', url: '/?name=alice' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ name: 'alice' });
    });

    it('Does not coerce tuple single values (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            querystring: z.object({ pair: z.tuple([z.string(), z.string()]) }),
          },
        },
        (req) => ({ pair: req.query.pair }),
      );

      const response = await app.inject({ method: 'GET', url: '/?pair=a' });
      expect(response.statusCode).toBe(400);
    });

    it('Coerces single header value into array (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            headers: z.object({ 'x-roles': z.array(z.string()) }).loose(),
          },
        },
        (req) => ({ roles: req.headers['x-roles'] }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-roles': 'admin' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ roles: ['admin'] });
    });

    it('Coerces single params value into array (#151)', async () => {
      // Params validation runs on the parsed object; wildcard routes can expose arrays.
      // Direct compiler test proves the httpPart branch is wired correctly.
      const validate = validatorCompiler({
        schema: z.object({ ids: z.array(z.string()) }),
        httpPart: 'params',
        url: '/',
        method: 'GET',
      });

      const result = validate({ ids: 'only-one' });
      expect(result).toEqual({ value: { ids: ['only-one'] } });
    });

    it('Does not coerce body single value to array (#151)', async () => {
      const app = buildApp();
      app.post(
        '/',
        {
          schema: { body: z.object({ tags: z.array(z.string()) }) },
        },
        (req) => ({ tags: req.body.tags }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { tags: 'apple' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('Does not false-coerce when union matches non-array branch (#151)', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            querystring: z.object({
              value: z.union([z.array(z.string()), z.string()]),
            }),
          },
        },
        (req) => ({ value: req.query.value }),
      );

      const response = await app.inject({ method: 'GET', url: '/?value=apple' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ value: 'apple' });
    });
  });
});
