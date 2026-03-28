import Fastify from 'fastify';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from './index.js';
import { serializerCompiler } from './serializer.js';
import { validatorCompiler } from './validator.js';

const buildApp = () => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

describe('error handling', () => {
  it('returns 400 with structured error on body validation error', async () => {
    const app = buildApp();
    app.post(
      '/',
      {
        schema: {
          body: z.object({ name: z.string(), age: z.number() }),
        },
      },
      (req) => req.body,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: 123, age: 'not-a-number' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('statusCode', 400);
    expect(body).toHaveProperty('error', 'Bad Request');
    expect(body).toHaveProperty('message');
  });

  it('produces empty instancePath for root-level validation errors', async () => {
    const app = buildApp();
    app.post(
      '/',
      {
        schema: {
          body: z.string(),
        },
      },
      (req) => req.body,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/',
      payload: JSON.stringify(42),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(400);
  });
});
