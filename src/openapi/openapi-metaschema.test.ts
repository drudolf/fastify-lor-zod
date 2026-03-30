import swagger from '@fastify/swagger';
import { Validator } from '@seriousme/openapi-schema-validator';
import Fastify from 'fastify';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from '../index.js';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from '../index.js';

const validator = new Validator();

const buildApp = async (oasVersion: '3.0.3' | '3.1.0') => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: oasVersion,
      info: { title: 'Metaschema Test', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();

  const ErrorSchema = z.object({ error: z.string() }).meta({ id: 'ErrorResponse' });

  typedApp.post('/users', {
    schema: {
      body: z.object({ name: z.string(), email: z.email() }),
      querystring: z.object({ page: z.coerce.number().int().default(1) }),
      headers: z.object({ 'x-api-key': z.string() }).loose(),
      response: {
        201: z.object({ id: z.number(), name: z.string() }),
        400: ErrorSchema,
      },
    },
    handler: async (_req, reply) => {
      reply.code(201).send({ id: 1, name: 'Alice' });
    },
  });

  typedApp.get('/users/:id', {
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: z.object({
          id: z.number(),
          name: z.string(),
          tags: z.array(z.string()),
          address: z.object({ city: z.string() }).nullable(),
        }),
      },
    },
    handler: () => ({ id: 1, name: 'Alice', tags: [], address: null }),
  });

  await app.ready();
  return app;
};

describe('OpenAPI Metaschema Validation', () => {
  it('Generated OAS 3.0.3 spec passes official metaschema validation', async () => {
    const app = await buildApp('3.0.3');
    const spec = app.swagger();
    const result = await validator.validate(JSON.parse(JSON.stringify(spec)));

    expect(
      result.errors,
      `OAS 3.0.3 metaschema errors: ${JSON.stringify(result.errors)}`,
    ).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it('Generated OAS 3.1.0 spec passes official metaschema validation', async () => {
    const app = await buildApp('3.1.0');
    const spec = app.swagger();
    const result = await validator.validate(JSON.parse(JSON.stringify(spec)));

    expect(
      result.errors,
      `OAS 3.1.0 metaschema errors: ${JSON.stringify(result.errors)}`,
    ).toBeUndefined();
    expect(result.valid).toBe(true);
  });
});
