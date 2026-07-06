import swagger from '@fastify/swagger';
import type { ZodTypeProvider as FastifyOrgTypeProvider } from '@fastify/type-provider-zod';
import {
  serializerCompiler as fastifyOrgSerializer,
  jsonSchemaTransform as fastifyOrgTransform,
  validatorCompiler as fastifyOrgValidator,
} from '@fastify/type-provider-zod';
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
import {
  type BenchRoute,
  benchOpts,
  FullRouteSchema,
  makeBenchRoutes,
  validCreateUserData,
  validUserResponseData,
} from './schemas.js';

let _result: unknown;

// --- Build full Fastify apps for end-to-end OpenAPI generation ---

const DEFAULT_ROUTES: BenchRoute[] = [{ url: '/users/:id', schema: FullRouteSchema }];

// Handler is only invoked by the success-path e2e group; it returns data valid
// against FullRouteSchema's 200 response so serialization runs. Status pinned
// so the sanity guard below can assert exactly 200.
const sendUserResponse = (
  _req: unknown,
  reply: { code: (c: number) => { send: (d: unknown) => void } },
) => {
  reply.code(200).send(validUserResponseData);
};

const buildLorZodApp = async (routes: BenchRoute[] = DEFAULT_ROUTES) => {
  const app = Fastify();
  app.setValidatorCompiler(lorZodValidator);
  app.setSerializerCompiler(lorZodSerializer);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: lorZodTransform,
    transformObject: lorZodTransformObject,
  });
  const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();
  for (const route of routes) {
    typedApp.post(route.url, { schema: route.schema }, sendUserResponse as never);
  }
  await app.ready();
  return app;
};

const buildTurkerApp = async (routes: BenchRoute[] = DEFAULT_ROUTES) => {
  const app = Fastify();
  app.setValidatorCompiler(turkerValidator);
  app.setSerializerCompiler(turkerSerializer);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: turkerTransform,
  });
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  for (const route of routes) {
    typedApp.post(route.url, { schema: route.schema }, sendUserResponse as never);
  }
  await app.ready();
  return app;
};

const buildFastifyOrgApp = async (routes: BenchRoute[] = DEFAULT_ROUTES) => {
  const app = Fastify();
  app.setValidatorCompiler(fastifyOrgValidator);
  app.setSerializerCompiler(fastifyOrgSerializer);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: fastifyOrgTransform,
  });
  const typedApp = app.withTypeProvider<FastifyOrgTypeProvider>();
  for (const route of routes) {
    typedApp.post(route.url, { schema: route.schema }, sendUserResponse as never);
  }
  await app.ready();
  return app;
};

const buildSamchungyApp = async (routes: BenchRoute[] = DEFAULT_ROUTES) => {
  const app = Fastify();
  app.setValidatorCompiler(samchungyValidator);
  app.setSerializerCompiler(samchungySerializer);
  await app.register(fastifyZodOpenApiPlugin);

  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Bench', version: '1.0.0' } },
    transform: fastifyZodOpenApiTransformers.transform,
    transformObject: fastifyZodOpenApiTransformers.transformObject,
  });
  for (const route of routes) {
    app.post(route.url, { schema: route.schema }, sendUserResponse as never);
  }
  await app.ready();
  return app;
};

const builders = {
  'fastify-lor-zod': buildLorZodApp,
  'fastify-type-provider-zod': buildTurkerApp,
  '@fastify/type-provider-zod': buildFastifyOrgApp,
  'fastify-zod-openapi': buildSamchungyApp,
} as const;

const validInjectOpts = {
  method: 'POST' as const,
  url: '/users/1',
  headers: { 'x-api-key': 'bench' },
  payload: validCreateUserData,
};

// --- Sanity guards (throwaway apps, so shared bench subjects stay unwarmed) ---
// A provider that rejects the valid request or drops routes from its spec
// would otherwise silently bench a different code path and report garbage.
for (const [name, build] of Object.entries(builders)) {
  const probe = await build();
  const response = await probe.inject(validInjectOpts);
  if (response.statusCode !== 200) {
    throw new Error(`[bench] ${name} returned ${response.statusCode} for the valid request`);
  }
  await probe.close();

  const probe50 = await build(makeBenchRoutes(50));
  const pathCount = Object.keys(probe50.swagger().paths ?? {}).length;
  if (pathCount !== 50) {
    throw new Error(`[bench] ${name} generated ${pathCount}/50 paths in the 50-route spec`);
  }
  await probe50.close();
}

// Pre-build apps (OpenAPI generation happens at app.swagger() time)
const lorZodApp = await buildLorZodApp();
const turkerApp = await buildTurkerApp();
const fastifyOrgApp = await buildFastifyOrgApp();
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
    '@fastify/type-provider-zod',
    () => {
      _result = fastifyOrgApp.swagger();
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
    '@fastify/type-provider-zod',
    async () => {
      _result = await buildFastifyOrgApp();
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

  const fastifyOrgValidate = fastifyOrgValidator(
    validatorArgs as Parameters<typeof fastifyOrgValidator>[0],
  );

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
    '@fastify/type-provider-zod',
    () => {
      _result = fastifyOrgValidate(invalidBody);
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
    '@fastify/type-provider-zod',
    async () => {
      _result = await fastifyOrgApp.inject(injectOpts);
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

describe('Request lifecycle — success path (end-to-end via app.inject)', () => {
  const apps = {
    'fastify-lor-zod': lorZodApp,
    'fastify-type-provider-zod': turkerApp,
    '@fastify/type-provider-zod': fastifyOrgApp,
    'fastify-zod-openapi': samchungyApp,
  };

  for (const [name, app] of Object.entries(apps)) {
    bench(
      name,
      async () => {
        _result = await app.inject(validInjectOpts);
      },
      benchOpts,
    );
  }
});

// Cold start including first OpenAPI generation. Fresh schemas are constructed
// inside the timed iteration so schema-keyed caches stay genuinely cold; the
// zod construction cost is identical for all providers, but it is a constant
// additive term that compresses relative provider ratios — compare absolute
// deltas, not ratios. Apps are closed inside the iteration (symmetric for all
// providers) so open handles don't accumulate across hundreds of samples.
// See makeBenchRoutes for the anti-dedup caveat.
describe('Cold start — 50 routes (build + ready + first swagger())', () => {
  for (const [name, build] of Object.entries(builders)) {
    bench(
      name,
      async () => {
        const app = await build(makeBenchRoutes(50));
        _result = app.swagger();
        await app.close();
      },
      benchOpts,
    );
  }
});
