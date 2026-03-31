import Fastify from 'fastify';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from '../index.js';
import { serializerCompiler } from '../serializer/serializer.js';
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
          context: undefined,
          validation: [expect.objectContaining({ schemaPath: '#/name' })],
        }),
      });
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
});
