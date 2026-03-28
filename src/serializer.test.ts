import Fastify from 'fastify';
import type { FastifySerializerCompiler } from 'fastify/types/schema';
import { z } from 'zod';

import { ResponseSerializationError } from './errors.js';
import type { FastifyLorZodTypeProvider } from './index.js';
import {
  createSerializerCompiler,
  fastSerializerCompiler,
  parseSerializerCompiler,
  serializerCompiler,
} from './serializer.js';
import { validatorCompiler } from './validator.js';

const buildApp = (compiler: FastifySerializerCompiler<z.ZodType>) => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(compiler);
  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

const allSerializers = [
  { name: 'safeEncode', compiler: serializerCompiler },
  { name: 'safeParse', compiler: parseSerializerCompiler },
  { name: 'fast', compiler: fastSerializerCompiler },
] as const;

const validatingSerializers = allSerializers.filter((s) => s.name !== 'fast');

describe.each(allSerializers)('serializer — $name', ({ compiler }) => {
  it('returns 204 with empty response schema', async () => {
    const app = buildApp(compiler);
    app.get('/', { schema: { response: { 204: z.undefined() } } }, (_req, reply) => {
      reply.code(204).send();
    });

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('returns 200 on correct string response', async () => {
    const app = buildApp(compiler);
    app.get('/', { schema: { response: { 200: z.string() } } }, () => 'hello');

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('hello');
  });

  it('returns 200 on correct object response', async () => {
    const app = buildApp(compiler);
    app.get(
      '/',
      { schema: { response: { 200: z.object({ name: z.string(), age: z.number() }) } } },
      () => ({ name: 'Alice', age: 30 }),
    );

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: 'Alice', age: 30 });
  });

  it('handles nested schemas', async () => {
    const app = buildApp(compiler);
    app.get(
      '/order',
      {
        schema: {
          response: {
            200: z.object({
              id: z.number(),
              items: z.array(z.object({ name: z.string(), qty: z.number() })),
            }),
          },
        },
      },
      () => ({ id: 1, items: [{ name: 'Widget', qty: 3 }] }),
    );

    const response = await app.inject({ method: 'GET', url: '/order' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: 1, items: [{ name: 'Widget', qty: 3 }] });
  });

  it('strips extra fields not in schema', async () => {
    const app = buildApp(compiler);
    app.get('/', { schema: { response: { 200: z.object({ id: z.number() }) } } }, () => ({
      id: 1,
      secret: 'should-be-stripped',
    }));

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.id).toBe(1);
    expect(body.secret).toBeUndefined();
  });
});

describe.each(validatingSerializers)('serializer — $name — validation errors', ({ compiler }) => {
  it('throws 500 on non-empty response with 204 schema', async () => {
    const app = buildApp(compiler);
    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ResponseSerializationError) {
        reply.code(500).send({ error: 'serialization failed' });
        return;
      }
      reply.send(error);
    });
    app.get('/', { schema: { response: { 204: z.undefined() } } }, (_req, reply) => {
      reply.code(204).send({ unexpected: 'data' } as unknown as undefined);
    });

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(500);
  });

  it('returns 500 on incorrect string response', async () => {
    const app = buildApp(compiler);
    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ResponseSerializationError) {
        reply.code(500).send({ error: 'serialization failed' });
        return;
      }
      reply.send(error);
    });
    app.get('/', { schema: { response: { 200: z.string() } } }, () => 42 as unknown as string);

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(500);
  });

  it('returns 500 on incorrect object response', async () => {
    const app = buildApp(compiler);
    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ResponseSerializationError) {
        reply.code(500).send({ error: 'serialization failed' });
        return;
      }
      reply.send(error);
    });
    app.get(
      '/',
      { schema: { response: { 200: z.object({ name: z.string(), age: z.number() }) } } },
      () => ({ name: 'Alice', age: 'not-a-number' }) as unknown as { name: string; age: number },
    );

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(500);
  });
});

describe('serializer — safeEncode only', () => {
  it('serializer uses encode for codec schemas', async () => {
    const app = buildApp(serializerCompiler);
    const dateCodec = z.codec(z.iso.datetime(), z.date(), {
      decode: (isoString: string) => new Date(isoString),
      encode: (date: Date) => date.toISOString(),
    });

    app.get('/', { schema: { response: { 200: z.object({ createdAt: dateCodec }) } } }, () => ({
      createdAt: new Date('2024-01-15T10:30:00.000Z'),
    }));

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.createdAt).toBe('2024-01-15T10:30:00.000Z');
  });

  it('custom serializer replacer modifies JSON.stringify output', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(
      createSerializerCompiler({
        replacer: (key, value) => {
          if (key === 'secret') return '[REDACTED]';
          return value;
        },
      }),
    );
    const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();

    typedApp.get(
      '/',
      { schema: { response: { 200: z.object({ name: z.string(), secret: z.string() }) } } },
      () => ({ name: 'Alice', secret: 'my-password' }),
    );

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Alice');
    expect(body.secret).toBe('[REDACTED]');
  });
});
