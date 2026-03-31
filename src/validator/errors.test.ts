import Fastify from 'fastify';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from '../index.js';
import { serializerCompiler } from '../serializer/serializer.js';
import { mapIssueToValidationError, RequestValidationError } from './errors.js';
import { validatorCompiler } from './validator.js';
import assert from 'node:assert';

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
    assert(caughtError instanceof RequestValidationError);
    expect(caughtError).toMatchObject({
      code: 'ERR_REQUEST_VALIDATION',
      context: 'body',
    });
    expect(caughtError.validation.length).toBeGreaterThan(0);
  });

  it('stores input on RequestValidationError', async () => {
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
          body: z.object({ name: z.string() }),
        },
      },
      (req) => req.body,
    );

    const payload = { name: 42 };
    await app.inject({
      method: 'POST',
      url: '/',
      payload,
    });

    assert(caughtError instanceof RequestValidationError);
    expect(caughtError.input).toEqual(payload);
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
    assert(caughtError instanceof RequestValidationError);
    expect(caughtError.validation[0].instancePath).toBe('');
  });
});

describe('Error mapping', () => {
  const makeIssue = (
    overrides: Partial<z.core.$ZodIssueInvalidType> = {},
  ): z.core.$ZodIssueInvalidType => ({
    code: 'invalid_type',
    expected: 'string',
    input: 42,
    path: [],
    message: 'Expected string, received number',
    ...overrides,
  });

  it('maps issue path to instancePath', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['user', 'name'] }), 'body');
    expect(result.instancePath).toBe('/user/name');
  });

  it('produces empty instancePath for root-level issue', () => {
    const result = mapIssueToValidationError(makeIssue({ path: [] }), 'body');
    expect(result.instancePath).toBe('');
  });

  it('includes httpPart in schemaPath', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['name'] }), 'body');
    expect(result.schemaPath).toBe('#/body/name');
  });

  it('omits httpPart from schemaPath when undefined', () => {
    const result = mapIssueToValidationError(makeIssue({ path: ['name'] }));
    expect(result.schemaPath).toBe('#/name');
  });

  it('spreads remaining issue properties into params', () => {
    const extras = { minimum: 5, inclusive: true };
    const result = mapIssueToValidationError(
      { ...makeIssue({ expected: 'string', input: 42 }), ...extras },
      'body',
    );
    expect(result.params).toEqual({ expected: 'string', input: 42, minimum: 5, inclusive: true });
  });
});
