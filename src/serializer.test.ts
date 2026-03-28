import Fastify from 'fastify';
import { z } from 'zod';

import { ResponseSerializationError } from './errors.js';
import type { FastifyLorZodTypeProvider } from './index.js';
import { createSerializerCompiler, serializerCompiler } from './serializer.js';
import { validatorCompiler } from './validator.js';

const buildApp = () => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

describe('serializer', () => {
  describe('response validation', () => {
    it('returns 204 with empty response schema', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            response: { 204: z.undefined() },
          },
        },
        (_req, reply) => {
          reply.code(204).send();
        },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });

    it('throws 500 on non-empty response with 204 schema', async () => {
      const app = buildApp();
      app.setErrorHandler((error, _req, reply) => {
        if (error instanceof ResponseSerializationError) {
          reply.code(500).send({ error: 'serialization failed' });
          return;
        }
        reply.send(error);
      });
      app.get(
        '/',
        {
          schema: {
            response: { 204: z.undefined() },
          },
        },
        (_req, reply) => {
          // Incorrectly sending a body with a 204 schema
          reply.code(204).send({ unexpected: 'data' } as unknown as undefined);
        },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(500);
    });

    it('returns 200 on correct string response', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            response: { 200: z.string() },
          },
        },
        () => 'hello',
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      // JSON.stringify("hello") = "hello" (with quotes), but Fastify sends raw body
      expect(response.body).toContain('hello');
    });

    it('returns 500 on incorrect string response', async () => {
      const app = buildApp();
      app.setErrorHandler((error, _req, reply) => {
        if (error instanceof ResponseSerializationError) {
          reply.code(500).send({ error: 'serialization failed' });
          return;
        }
        reply.send(error);
      });
      app.get(
        '/',
        {
          schema: {
            response: { 200: z.string() },
          },
        },
        () => 42 as unknown as string,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(500);
    });

    it('returns 200 on correct object response', async () => {
      const app = buildApp();
      app.get(
        '/',
        {
          schema: {
            response: {
              200: z.object({ name: z.string(), age: z.number() }),
            },
          },
        },
        () => ({ name: 'Alice', age: 30 }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ name: 'Alice', age: 30 });
    });

    it('returns 500 on incorrect object response', async () => {
      const app = buildApp();
      app.setErrorHandler((error, _req, reply) => {
        if (error instanceof ResponseSerializationError) {
          reply.code(500).send({ error: 'serialization failed' });
          return;
        }
        reply.send(error);
      });
      app.get(
        '/',
        {
          schema: {
            response: {
              200: z.object({ name: z.string(), age: z.number() }),
            },
          },
        },
        () =>
          ({ name: 'Alice', age: 'not-a-number' }) as unknown as {
            name: string;
            age: number;
          },
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(500);
    });

    it('custom serializer replacer modifies JSON.stringify output', async () => {
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      const customSerializer = createSerializerCompiler({
        replacer: (key, value) => {
          // Redact sensitive fields during serialization
          if (key === 'secret') {
            return '[REDACTED]';
          }
          return value;
        },
      });
      app.setSerializerCompiler(customSerializer);
      const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();

      typedApp.get(
        '/',
        {
          schema: {
            response: {
              200: z.object({ name: z.string(), secret: z.string() }),
            },
          },
        },
        () => ({ name: 'Alice', secret: 'my-password' }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Alice');
      expect(body.secret).toBe('[REDACTED]');
    });
  });

  describe('Zod encode', () => {
    it('serializer uses encode for codec schemas', async () => {
      const app = buildApp();
      const dateCodec = z.codec(z.iso.datetime(), z.date(), {
        decode: (isoString: string) => new Date(isoString),
        encode: (date: Date) => date.toISOString(),
      });

      app.get(
        '/',
        {
          schema: {
            response: {
              200: z.object({ createdAt: dateCodec }),
            },
          },
        },
        () => ({
          createdAt: new Date('2024-01-15T10:30:00.000Z'),
        }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.createdAt).toBe('2024-01-15T10:30:00.000Z');
    });
  });
});
