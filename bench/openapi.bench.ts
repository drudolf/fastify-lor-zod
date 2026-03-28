import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  serializerCompiler as turkerSerializer,
  jsonSchemaTransform as turkerTransform,
  validatorCompiler as turkerValidator,
} from 'fastify-type-provider-zod';
import {
  fastifyZodOpenApiPlugin,
  fastifyZodOpenApiTransformers,
  serializerCompiler as samchungySerializer,
  validatorCompiler as samchungyValidator,
} from 'fastify-zod-openapi';
import { bench, describe } from 'vitest';

import type { FastifyLorZodTypeProvider } from '../src/index.js';
import { jsonSchemaTransform as lorZodTransform } from '../src/schema-transform.js';
import { serializerCompiler as lorZodSerializer } from '../src/serializer.js';
import { validatorCompiler as lorZodValidator } from '../src/validator.js';
import { benchOpts, FullRouteSchema } from './schemas.js';

let _result: unknown;

// --- Build full Fastify apps for end-to-end OpenAPI generation ---

const buildLorZodApp = async () => {
  const app = Fastify();
  app.setValidatorCompiler(lorZodValidator);
  app.setSerializerCompiler(lorZodSerializer);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: lorZodTransform,
  });
  const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();
  typedApp.post('/users/:id', { schema: FullRouteSchema }, (_req, reply) => {
    reply.send({});
  });
  await app.ready();
  return app;
};

const buildTurkerApp = async () => {
  const app = Fastify();
  app.setValidatorCompiler(turkerValidator);
  app.setSerializerCompiler(turkerSerializer);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: turkerTransform,
  });
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  typedApp.post('/users/:id', { schema: FullRouteSchema }, (_req, reply) => {
    reply.send({});
  });
  await app.ready();
  return app;
};

const buildSamchungyApp = async () => {
  const app = Fastify();
  app.setValidatorCompiler(samchungyValidator);
  app.setSerializerCompiler(samchungySerializer);
  await app.register(fastifyZodOpenApiPlugin);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: fastifyZodOpenApiTransformers.transform,
    transformObject: fastifyZodOpenApiTransformers.transformObject,
  });
  app.post('/users/:id', { schema: FullRouteSchema }, (_req, reply) => {
    reply.send({});
  });
  await app.ready();
  return app;
};

// Pre-build apps (OpenAPI generation happens at app.swagger() time)
const lorZodApp = await buildLorZodApp();
const turkerApp = await buildTurkerApp();
const samchungyApp = await buildSamchungyApp();

describe('OpenAPI spec generation — full app with route', () => {
  bench(
    'fastify-lor-zod',
    () => {
      _result = lorZodApp.swagger();
    },
    benchOpts,
  );

  bench(
    'fastify-type-provider-zod',
    () => {
      _result = turkerApp.swagger();
    },
    benchOpts,
  );

  bench(
    'fastify-zod-openapi',
    () => {
      _result = samchungyApp.swagger();
    },
    benchOpts,
  );
});
