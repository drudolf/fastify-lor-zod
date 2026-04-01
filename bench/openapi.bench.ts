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
import {
  jsonSchemaTransform as lorZodTransform,
  jsonSchemaTransformObject as lorZodTransformObject,
} from '../src/openapi/schema-transform.js';
import { serializerCompiler as lorZodSerializer } from '../src/serializer/serializer.js';
import { validatorCompiler as lorZodValidator } from '../src/validator/validator.js';
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
    transformObject: lorZodTransformObject,
  });
  const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();
  typedApp.post('/users/:id', { schema: FullRouteSchema }, (_req, reply) => {
    reply.send({} as never);
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
    reply.send({} as never);
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
    reply.send({} as never);
  });
  await app.ready();
  return app;
};

// Pre-build apps (OpenAPI generation happens at app.swagger() time)
const lorZodApp = await buildLorZodApp();
const turkerApp = await buildTurkerApp();
const samchungyApp = await buildSamchungyApp();

describe('OpenAPI spec generation — cached (app.swagger())', () => {
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

describe('OpenAPI spec generation — cold (build + ready)', () => {
  bench(
    'fastify-lor-zod',
    async () => {
      _result = await buildLorZodApp();
    },
    benchOpts,
  );

  bench(
    'fastify-type-provider-zod',
    async () => {
      _result = await buildTurkerApp();
    },
    benchOpts,
  );

  bench(
    'fastify-zod-openapi',
    async () => {
      _result = await buildSamchungyApp();
    },
    benchOpts,
  );
});

describe('Validation — error path (validator only)', () => {
  const invalidBody = { name: 123, email: 'not-an-email' };

  const validatorArgs = {
    schema: FullRouteSchema.body,
    httpPart: 'body',
    method: 'POST',
    url: '/users/:id',
  };

  const lorZodValidate = lorZodValidator(validatorArgs as Parameters<typeof lorZodValidator>[0]);

  const turkerValidate = turkerValidator(validatorArgs as Parameters<typeof turkerValidator>[0]);

  const samchungyValidate = samchungyValidator(
    validatorArgs as Parameters<typeof samchungyValidator>[0],
  );

  bench(
    'fastify-lor-zod',
    () => {
      _result = lorZodValidate(invalidBody);
    },
    benchOpts,
  );

  bench(
    'fastify-type-provider-zod',
    () => {
      _result = turkerValidate(invalidBody);
    },
    benchOpts,
  );

  bench(
    'fastify-zod-openapi',
    () => {
      _result = samchungyValidate(invalidBody);
    },
    benchOpts,
  );
});

describe('Validation — error path (end-to-end via app.inject)', () => {
  const invalidPayload = { name: 123, email: 'not-an-email' };
  const injectOpts = {
    method: 'POST' as const,
    url: '/users/1',
    headers: { 'x-api-key': 'bench' },
    payload: invalidPayload,
  };

  bench(
    'fastify-lor-zod',
    async () => {
      _result = await lorZodApp.inject(injectOpts);
    },
    benchOpts,
  );

  bench(
    'fastify-type-provider-zod',
    async () => {
      _result = await turkerApp.inject(injectOpts);
    },
    benchOpts,
  );

  bench(
    'fastify-zod-openapi',
    async () => {
      _result = await samchungyApp.inject(injectOpts);
    },
    benchOpts,
  );
});
