import Fastify from 'fastify';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from '../index.js';
import { serializerCompiler } from '../serializer/serializer.js';
import { RequestValidationError } from './errors.js';
import { validatorCompiler } from './validator.js';

const buildApp = () => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

describe('error handling', () => {
  it('returns 400 with structured error on body validation error', async () => {
    let caughtError: unknown;
    const app = buildApp();
    app.setErrorHandler((error: Error, _req, reply) => {
      caughtError = error;
      reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
    });
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
    expect(caughtError).toBeInstanceOf(RequestValidationError);
    const err = caughtError as RequestValidationError;
    expect(err.code).toBe('ERR_REQUEST_VALIDATION');
    expect(err.context).toBe('body');
    expect(err.validation.length).toBeGreaterThan(0);
  });

  it('produces empty instancePath for root-level validation errors', async () => {
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
    expect(caughtError).toBeInstanceOf(RequestValidationError);
    const err = caughtError as RequestValidationError;
    expect(err.validation[0].instancePath).toBe('');
  });
});
