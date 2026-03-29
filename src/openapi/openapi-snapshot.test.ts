import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { FastifyLorZodTypeProvider } from '../index.js';
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from '../index.js';

const OPENAPI_ROOT = {
  openapi: {
    openapi: '3.0.3' as const,
    info: {
      title: 'SampleApi',
      description: 'Sample backend service',
      version: '1.0.0',
    },
    servers: [],
  },
};

describe('transformer', () => {
  it('generates types for fastify-swagger correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
    });

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      seed: z.number().min(1).max(1000),
      code: z.number().lt(10000),
      password: z.string().max(32),
    });

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin').nullable(),
      scopes: z.tuple([z.literal('read'), z.literal('write'), z.null()]),
    });

    app.after(() => {
      app
        .withTypeProvider<FastifyLorZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/login',
          schema: {
            description: 'login route',
            summary: 'login your account',
            consumes: ['application/json'],
            deprecated: false,
            hide: false,
            tags: ['auth'],
            externalDocs: { url: 'https://google.com', description: 'check google' },
            body: LOGIN_SCHEMA,
            response: {
              200: z.string(),
              401: UNAUTHORIZED_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('ok');
          },
        })
        .route({
          method: 'POST',
          url: '/no-schema',
          schema: undefined,
          handler: (_req, res) => {
            res.send('ok');
          },
        })
        .route({
          method: 'DELETE',
          url: '/delete',
          schema: {
            description: 'delete route',
            response: {
              204: z.undefined().describe('Empty response'),
            },
          },
          handler: (_req, res) => {
            res.status(204).send();
          },
        });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('generates types for fastify-swagger with OAS 3.1.0 correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: createJsonSchemaTransform({
        zodToJsonConfig: {
          target: 'draft-2020-12',
        },
      }),
    });

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      seed: z.number().min(1).max(1000),
      code: z.number().lt(10000),
      password: z.string().max(32),
    });

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin').nullable(),
      scopes: z.tuple([z.literal('read'), z.literal('write'), z.null()]),
    });

    app.after(() => {
      app
        .withTypeProvider<FastifyLorZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/login',
          schema: {
            description: 'login route',
            summary: 'login your account',
            consumes: ['application/json'],
            deprecated: false,
            hide: false,
            tags: ['auth'],
            externalDocs: { url: 'https://google.com', description: 'check google' },
            body: LOGIN_SCHEMA,
            response: {
              200: z.string(),
              401: UNAUTHORIZED_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('ok');
          },
        })
        .route({
          method: 'POST',
          url: '/no-schema',
          schema: undefined,
          handler: (_req, res) => {
            res.send('ok');
          },
        })
        .route({
          method: 'DELETE',
          url: '/delete',
          schema: {
            description: 'delete route',
            response: {
              204: z.undefined().describe('Empty response'),
            },
          },
          handler: (_req, res) => {
            res.status(204).send();
          },
        });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should fail generating types for fastify-swagger Swagger 2.0 correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(swagger, {
      swagger: {
        swagger: '2.0',
        info: {
          title: 'SampleApi',
          description: 'Sample backend service',
          version: '1.0.0',
        },
      },
      transform: jsonSchemaTransform,
    });

    const LOGIN_SCHEMA = z.object({
      username: z.string().max(32).describe('someDescription'),
      seed: z.number().min(1).max(1000),
      code: z.number().lt(10000),
      password: z.string().max(32),
    });

    const UNAUTHORIZED_SCHEMA = z.object({
      required_role: z.literal('admin').nullable(),
      scopes: z.tuple([z.literal('read'), z.literal('write'), z.null()]),
    });

    app.after(() => {
      app
        .withTypeProvider<FastifyLorZodTypeProvider>()
        .route({
          method: 'POST',
          url: '/login',
          schema: {
            description: 'login route',
            summary: 'login your account',
            consumes: ['application/json'],
            deprecated: false,
            hide: false,
            tags: ['auth'],
            externalDocs: { url: 'https://google.com', description: 'check google' },
            body: LOGIN_SCHEMA,
            response: {
              200: z.string(),
              401: UNAUTHORIZED_SCHEMA,
            },
          },
          handler: (_req, res) => {
            res.send('ok');
          },
        })
        .route({
          method: 'POST',
          url: '/no-schema',
          schema: undefined,
          handler: (_req, res) => {
            res.send('ok');
          },
        })
        .route({
          method: 'DELETE',
          url: '/delete',
          schema: {
            description: 'delete route',
            response: {
              204: z.undefined().describe('Empty response'),
            },
          },
          handler: (_req, res) => {
            res.status(204).send();
          },
        });
    });

    await app.ready();
    expect(() => app.swagger()).toThrowError('OpenAPI 2.0 is not supported');
  });

  it('should not generate ref', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: jsonSchemaTransform,
    });

    const TOKEN_SCHEMA = z.string().length(12);

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: z.object({
            access_token: TOKEN_SCHEMA,
            refresh_token: TOKEN_SCHEMA,
            metadata: z.record(z.string(), z.string()),
            age: z.optional(z.nullable(z.coerce.number())),
          }),
        },
        handler: (_req, res) => {
          res.send('ok');
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should generate ref correctly using z.registry', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const TOKEN_SCHEMA = z.string().length(12);

    const schemaRegistry = z.registry<{ id: string }>();

    schemaRegistry.add(TOKEN_SCHEMA, {
      id: 'Token',
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry, withInputSchema: true }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: z.object({
            access_token: TOKEN_SCHEMA,
            refresh_token: TOKEN_SCHEMA,
          }),
        },
        handler: (_req, res) => {
          res.send('ok');
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should generate ref correctly using global registry', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const TOKEN_SCHEMA = z.string().length(12);

    z.globalRegistry.add(TOKEN_SCHEMA, {
      id: 'Token',
      description: 'Token description',
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: jsonSchemaTransform,
      transformObject: createJsonSchemaTransformObject({ withInputSchema: true }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          body: z.object({
            access_token: TOKEN_SCHEMA,
            refresh_token: TOKEN_SCHEMA,
          }),
        },
        handler: (_req, res) => {
          res.send('ok');
        },
      });
    });

    await app.ready();

    const openApiSpec = app.swagger();
    z.globalRegistry.remove(TOKEN_SCHEMA);

    expect(openApiSpec).toMatchSnapshot();
  });

  it('should generate nested and circular refs correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const GROUP_SCHEMA = z.object({
      id: z.string(),
      get subgroups() {
        return z.array(GROUP_SCHEMA);
      },
    });

    const USER_SCHEMA = z.object({
      id: z.string(),
      groups: z.array(GROUP_SCHEMA),
    });

    const schemaRegistry = z.registry<{ id: string }>();

    schemaRegistry.add(GROUP_SCHEMA, {
      id: 'Group',
    });
    schemaRegistry.add(USER_SCHEMA, {
      id: 'User',
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry, withInputSchema: true }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          response: {
            200: z.object({
              groups: z.array(GROUP_SCHEMA),
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            groups: [],
            user: {
              id: '1',
              groups: [],
            },
          });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should generate nullable arrays correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const USER_SCHEMA = z.object({
      id: z.string(),
      values: z.array(z.string()).nullable(),
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({}),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          response: {
            200: z.object({
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            user: {
              id: '1',
              values: null,
            },
          });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should handle records within records', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const USER_SCHEMA = z.object({
      id: z.string(),
      files: z.record(z.string(), z.record(z.string(), z.string())),
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({}),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/login',
        schema: {
          response: {
            200: z.object({
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            user: {
              id: '1',
              files: {},
            },
          });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should generate input and output schemas correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const schemaRegistry = z.registry<{ id: string }>();

    const ID_SCHEMA = z.string().default('1');

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry, withInputSchema: true }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'GET',
        url: '/',
        schema: {
          querystring: z.object({
            id: ID_SCHEMA,
          }),
          response: {
            200: z.object({
              id: ID_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            id: '1',
          });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should generate referenced input and output schemas correctly', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const schemaRegistry = z.registry<{ id: string }>();

    const USER_SCHEMA = z.object({
      id: z.string().default('1'),
      createdAt: z.date(),
    });

    schemaRegistry.add(USER_SCHEMA, {
      id: 'User',
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry, withInputSchema: true }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/',
        schema: {
          body: z.object({
            user: USER_SCHEMA,
          }),
          response: {
            200: z.object({
              user: USER_SCHEMA,
            }),
          },
        },
        handler: (_req, res) => {
          res.send({
            user: {
              id: '1',
              createdAt: new Date(0),
            },
          });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should generate referenced input and output schemas correctly when referencing a registered schema', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const schemaRegistry = z.registry<{ id: string }>();

    const USER_SCHEMA = z.object({
      id: z.string().default('1'),
      createdAt: z.date(),
    });

    schemaRegistry.add(USER_SCHEMA, { id: 'User' });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry }),
      transformObject: createJsonSchemaTransformObject({ schemaRegistry, withInputSchema: true }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/',
        schema: {
          body: USER_SCHEMA,
          response: { 200: USER_SCHEMA },
        },
        handler: (_, res) => {
          res.send({
            id: '1',
            createdAt: new Date(0),
          });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('should allow specification of Zod target to handle OpenAPI 3.1', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // draft-2020-12 is aligned with OpenAPI 3.1.0
    const transform = createJsonSchemaTransform({
      zodToJsonConfig: { target: 'draft-2020-12' },
    });

    await app.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'TestApi',
          version: '1.0.0',
        },
      },
      transform,
    });

    const TEST_SCHEMA = z.object({
      id: z.string(),
      name: z.string().nullable(),
      metadata: z.record(z.string(), z.string()),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/test',
        schema: {
          body: TEST_SCHEMA,
          response: {
            200: z.object({
              success: z.boolean(),
              data: TEST_SCHEMA.nullable(),
            }),
          },
        },
        handler: (_req, res) => {
          res.send({ success: true, data: null });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });

  it('Should generate Input variant schemas with withInputSchema: true', async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    const registry = z.registry<z.GlobalMeta>();

    const PasswordLoginSchema = z.string().trim().min(8);
    const UserLoginRequestSchema = z.object({ name: z.string(), password: PasswordLoginSchema });
    const UserLoginResponseSchema = z.object({ id: z.number() });

    registry.add(PasswordLoginSchema, { id: 'PasswordLogin' });
    registry.add(UserLoginRequestSchema, {
      id: 'UserLoginRequest',
      description: 'User login request',
    });
    registry.add(UserLoginResponseSchema, {
      id: 'UserLoginResponse',
      description: 'User login response',
    });

    await app.register(swagger, {
      ...OPENAPI_ROOT,
      transform: createJsonSchemaTransform({ schemaRegistry: registry, withInputSchema: true }),
      transformObject: createJsonSchemaTransformObject({
        schemaRegistry: registry,
        withInputSchema: true,
      }),
    });

    app.after(() => {
      app.withTypeProvider<FastifyLorZodTypeProvider>().route({
        method: 'POST',
        url: '/api/v1/user/login',
        schema: {
          body: UserLoginRequestSchema,
          headers: z.object({ Authorization: z.string().optional() }),
          params: z.object({ id: z.coerce.number().positive() }),
          querystring: z.object({ filter: z.string().optional() }),
          response: { 200: UserLoginResponseSchema },
        },
        handler: (_req, res) => {
          res.code(200).send({ id: 0 });
        },
      });
    });

    await app.ready();
    expect(app.swagger()).toMatchSnapshot();
  });
});
