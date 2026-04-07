import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import { z } from 'zod';

import { get } from '../__tests__/setup.js';
import type { FastifyLorZodTypeProvider } from '../index.js';
import { serializerCompiler } from '../serializer/serializer.js';
import { validatorCompiler } from '../validator/validator.js';
import {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  createJsonSchemaTransforms,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from './schema-transform.js';

const buildAppWithSwagger = async (oasVersion: '3.0.3' | '3.1.0' = '3.0.3') => {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: oasVersion,
      info: { title: 'Test', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  return app.withTypeProvider<FastifyLorZodTypeProvider>();
};

describe('schema-transform', () => {
  describe('OpenAPI spec generation', () => {
    it('generates OAS 3.0.3 spec correctly', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.post(
        '/users',
        {
          schema: {
            body: z.object({ name: z.string(), email: z.email() }),
            response: {
              200: z.object({ id: z.number(), name: z.string() }),
            },
          },
        },
        (req) => ({ id: 1, name: req.body.name }),
      );

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, 'openapi')).toBe('3.0.3');
      expect(get(spec, ['paths', '/users'])).toBeDefined();
      expect(get(spec, ['paths', '/users', 'post'])).toBeDefined();
    });

    it('generates OAS 3.1.0 spec correctly', async () => {
      const app = await buildAppWithSwagger('3.1.0');

      app.get(
        '/health',
        {
          schema: {
            response: { 200: z.object({ status: z.string() }) },
          },
        },
        () => ({ status: 'ok' }),
      );

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, 'openapi')).toBe('3.1.0');
      expect(get(spec, ['paths', '/health'])).toBeDefined();
    });

    it('rejects Swagger 2.0', () => {
      const transform = createJsonSchemaTransform();

      expect(() =>
        transform({
          schema: {},
          url: '/test',
          route: { method: 'GET', url: '/test', handler: () => undefined },
          swaggerObject: {},
        }),
      ).toThrow('OpenAPI 2.0 is not supported');
    });

    it('generates inline schemas (no refs)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/item',
        {
          schema: {
            response: {
              200: z.object({
                id: z.number(),
                tags: z.array(z.string()),
              }),
            },
          },
        },
        () => ({ id: 1, tags: ['a'] }),
      );

      await app.ready();
      const spec = app.swagger();
      const responseSchema = get(spec, ['paths', '/item', 'get', 'responses', '200']);

      expect(responseSchema).toBeDefined();
      expect(JSON.stringify(responseSchema)).not.toContain('$ref');
    });

    it('generates refs via global registry', async () => {
      const UserSchema = z.object({ name: z.string(), email: z.string() }).meta({ id: 'User' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get('/user', { schema: { response: { 200: UserSchema } } }, () => ({
        name: 'Alice',
        email: 'a@b.com',
      }));

      await app.ready();
      const spec = app.swagger();

      const component = get(spec, ['components', 'schemas', 'User']);
      expect(component).toMatchObject({ type: 'object', properties: { name: { type: 'string' } } });

      const responseSchema = get(spec, [
        'paths',
        '/user',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);
      expect(responseSchema?.$ref).toBe('#/components/schemas/User');
    });

    it('handles all httpParts uniformly including params and querystring', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/items/:id',
        {
          schema: {
            params: z.object({ id: z.string() }),
            querystring: z.object({ limit: z.coerce.number().optional() }),
            headers: z.object({ 'x-token': z.string() }).loose(),
            response: { 200: z.object({ id: z.string() }) },
          },
        },
        (req) => ({ id: req.params.id }),
      );

      await app.ready();
      const spec = app.swagger();
      const paramNames = get(spec, ['paths', '/items/{id}', 'get', 'parameters'])?.map(
        (p: Record<string, unknown>) => p.name,
      );
      expect(paramNames).toEqual(expect.arrayContaining(['id', 'limit']));
    });

    it('generates input and output schemas correctly', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      const InputSchema = z.object({
        name: z.string(),
        role: z.string().default('user'),
      });

      app.post(
        '/users',
        {
          schema: {
            body: InputSchema,
            response: { 200: InputSchema },
          },
        },
        (req) => req.body,
      );

      await app.ready();
      const spec = app.swagger();
      const bodySchema = get(spec, [
        'paths',
        '/users',
        'post',
        'requestBody',
        'content',
        'application/json',
        'schema',
      ]);

      expect(Array.isArray(bodySchema?.required)).toBe(true);
      expect(bodySchema.required).not.toContain('role');
    });

    it('generates nullable types correctly for OAS 3.0', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/nullable',
        {
          schema: {
            response: {
              200: z.object({ value: z.string().nullable() }),
            },
          },
        },
        () => ({ value: null }),
      );

      await app.ready();
      const spec = app.swagger();
      const valueSchema = get(spec, [
        'paths',
        '/nullable',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'properties',
        'value',
      ]);

      expect(valueSchema?.nullable).toBe(true);
    });

    it('skips documentation routes by default', () => {
      const transform = createJsonSchemaTransform();

      const result = transform({
        schema: { body: z.object({ name: z.string() }) },
        url: '/documentation/',
        route: { method: 'GET', url: '/documentation', handler: () => ({ name: 'test' }) },
        openapiObject: { openapi: '3.0.3' },
      });

      expect(result.schema).toMatchObject({ hide: true });
    });

    it('hides route when schema has hide: true', () => {
      const transform = createJsonSchemaTransform();

      const result = transform({
        schema: { hide: true, body: z.object({ name: z.string() }) },
        url: '/health',
        route: { method: 'GET', url: '/health', handler: () => ({ ok: true }) },
        openapiObject: { openapi: '3.0.3' },
      });

      expect(result).toMatchObject({ schema: { hide: true }, url: '/health' });
    });

    it('allows zodToJsonConfig passthrough', () => {
      const transform = createJsonSchemaTransform({
        zodToJsonConfig: {
          target: 'openapi-3.0',
        },
      });

      const result = transform({
        schema: {
          body: z.object({ value: z.string() }),
        },
        url: '/test',
        route: { method: 'GET', url: '/test', handler: () => ({ value: 'test' }) },
        openapiObject: { openapi: '3.0.3' },
      });

      const body = result.schema.body as Record<string, unknown>;
      expect(body.type).toBe('object');
      // OAS 3.0 stripping should have removed $schema
      expect(body.$schema).toBeUndefined();
    });

    it('allows custom override to strip pattern from uuid (#233)', async () => {
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      await app.register(swagger, {
        openapi: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } },
        transform: createJsonSchemaTransform({
          zodToJsonConfig: {
            override: (ctx) => {
              if (ctx.jsonSchema.format === 'uuid') {
                delete ctx.jsonSchema.pattern;
              }
            },
          },
        }),
      });

      app.after(() => {
        app.withTypeProvider<FastifyLorZodTypeProvider>().route({
          method: 'GET',
          url: '/user',
          schema: {
            response: { 200: z.object({ id: z.uuid() }) },
          },
          handler: (_req, res) => {
            res.send({ id: '550e8400-e29b-41d4-a716-446655440000' });
          },
        });
      });

      await app.ready();
      const spec = app.swagger();

      const idSchema = get(spec, [
        'paths',
        '/user',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'properties',
        'id',
      ]);

      expect(idSchema).toMatchObject({ format: 'uuid' });
      expect(idSchema).not.toHaveProperty('pattern');
    });

    it('handles readonly schemas', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/readonly',
        {
          schema: {
            response: {
              200: z.object({ items: z.array(z.string()).readonly() }),
            },
          },
        },
        () => ({ items: ['a', 'b'] }),
      );

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, ['paths', '/readonly'])).toBeDefined();
    });

    it('generates refs via z.registry', async () => {
      const ProductSchema = z.object({ id: z.number(), name: z.string() }).meta({ id: 'Product' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get('/product', { schema: { response: { 200: ProductSchema } } }, () => ({
        id: 1,
        name: 'Widget',
      }));

      await app.ready();
      const spec = app.swagger();

      const component = get(spec, ['components', 'schemas', 'Product']);
      expect(component).toMatchObject({ type: 'object', properties: { id: { type: 'number' } } });

      const responseSchema = get(spec, [
        'paths',
        '/product',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);
      expect(responseSchema?.$ref).toBe('#/components/schemas/Product');
    });

    it('handles nested and circular refs', async () => {
      const NodeSchema: z.ZodType = z
        .object({ id: z.number(), children: z.lazy(() => z.array(NodeSchema)) })
        .meta({ id: 'TreeNode' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get('/tree', { schema: { response: { 200: NodeSchema } } }, () => ({
        id: 1,
        children: [],
      }));

      await app.ready();
      const spec = app.swagger();

      const component = get(spec, ['components', 'schemas', 'TreeNode']);
      expect(component).toMatchObject({ type: 'object', properties: { id: { type: 'number' } } });

      const responseSchema = get(spec, [
        'paths',
        '/tree',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);
      expect(responseSchema?.$ref).toBe('#/components/schemas/TreeNode');
    });

    it('generates referenced input and output schemas', async () => {
      const CreateUserSchema = z
        .object({ name: z.string(), role: z.string().default('user') })
        .meta({ id: 'CreateUser' });
      const UserResponseSchema = z
        .object({ id: z.number(), name: z.string(), role: z.string() })
        .meta({ id: 'UserResponse' });

      const app = await buildAppWithSwagger('3.0.3');
      app.post(
        '/users',
        { schema: { body: CreateUserSchema, response: { 201: UserResponseSchema } } },
        (req, reply) => {
          reply.code(201).send({ id: 1, name: req.body.name, role: req.body.role });
        },
      );

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, ['components', 'schemas', 'CreateUser'])).toMatchObject({ type: 'object' });
      expect(get(spec, ['components', 'schemas', 'UserResponse'])).toMatchObject({
        type: 'object',
      });

      const bodyRef = get(spec, [
        'paths',
        '/users',
        'post',
        'requestBody',
        'content',
        'application/json',
        'schema',
      ]);
      expect(bodyRef?.$ref).toBe('#/components/schemas/CreateUser');

      const responseRef = get(spec, [
        'paths',
        '/users',
        'post',
        'responses',
        '201',
        'content',
        'application/json',
        'schema',
      ]);
      expect(responseRef?.$ref).toBe('#/components/schemas/UserResponse');
    });

    it('generates referenced schemas for registered schemas', async () => {
      const AddressSchema = z
        .object({ street: z.string(), city: z.string() })
        .meta({ id: 'Address' });
      const PersonSchema = z
        .object({ name: z.string(), address: AddressSchema })
        .meta({ id: 'Person' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get('/person', { schema: { response: { 200: PersonSchema } } }, () => ({
        name: 'Alice',
        address: { street: '123 Main', city: 'Springfield' },
      }));

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, ['components', 'schemas', 'Address'])).toMatchObject({ type: 'object' });
      expect(get(spec, ['components', 'schemas', 'Person'])).toMatchObject({
        type: 'object',
        properties: { address: { $ref: '#/components/schemas/Address' } },
      });

      const responseRef = get(spec, [
        'paths',
        '/person',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);
      expect(responseRef?.$ref).toBe('#/components/schemas/Person');
    });

    it('allows Zod target configuration for OAS 3.1', async () => {
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      const transform = createJsonSchemaTransform();
      const transformObject = createJsonSchemaTransformObject();

      await app.register(swagger, {
        openapi: {
          openapi: '3.1.0',
          info: { title: 'Test', version: '1.0.0' },
        },
        transform,
        transformObject,
      });

      const typedApp = app.withTypeProvider<FastifyLorZodTypeProvider>();
      typedApp.get(
        '/nullable',
        {
          schema: {
            response: { 200: z.object({ value: z.string().nullable() }) },
          },
        },
        () => ({ value: null }),
      );

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, 'openapi')).toBe('3.1.0');
      // OAS 3.1 uses type arrays for nullable, not nullable: true
      const valueSchema = get(spec, [
        'paths',
        '/nullable',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'properties',
        'value',
      ]);

      expect(valueSchema).toBeDefined();
      // OAS 3.1 should NOT have nullable property — uses type arrays instead
      expect(valueSchema?.nullable).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('throws on non-Zod response schemas', () => {
      const transform = createJsonSchemaTransform();

      expect(() =>
        transform({
          schema: {
            response: {
              200: { type: 'object', properties: { id: { type: 'number' } } },
            },
          },
          url: '/test',
          route: { method: 'GET', url: '/test', handler: () => ({ id: 1 }) },
          openapiObject: { openapi: '3.0.3' },
        }),
      ).toThrow('Expected a Zod schema or { properties: ZodType } wrapper');
    });

    it('passes through non-schema keys like tags and description', () => {
      const transform = createJsonSchemaTransform();

      const result = transform({
        schema: {
          description: 'a route',
          summary: 'Create a user',
          tags: ['auth'],
          deprecated: true,
          operationId: 'createUser',
          security: [{ bearerAuth: [] }],
          body: z.object({ name: z.string() }),
        },
        url: '/test',
        route: { method: 'GET', url: '/test', handler: () => ({ name: 'test' }) },
        openapiObject: { openapi: '3.0.3' },
      });

      expect(result.schema).toMatchObject({
        description: 'a route',
        summary: 'Create a user',
        tags: ['auth'],
        deprecated: true,
        operationId: 'createUser',
        security: [{ bearerAuth: [] }],
      });
    });

    it('transformObject rejects Swagger 2.0', () => {
      const transformObject = createJsonSchemaTransformObject();

      expect(() =>
        transformObject({
          swaggerObject: {},
        }),
      ).toThrow('OpenAPI 2.0 is not supported');
    });

    it('passes through non-ZodType and non-object content entries', () => {
      const transform = createJsonSchemaTransform();

      const result = transform({
        schema: {
          body: {
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
              'text/plain': 'raw',
            },
          },
        },
        url: '/test',
        route: { method: 'GET', url: '/test', handler: () => 'raw' },
        openapiObject: { openapi: '3.0.3' },
      });

      expect(result.schema.body).toMatchObject({
        content: {
          // Non-ZodType schema passed through as-is
          'application/json': { schema: { type: 'object' } },
          // Non-object entry passed through
          'text/plain': 'raw',
        },
      });
    });

    it('defaults to OAS 3.0 when openapi version is not specified', () => {
      const transform = createJsonSchemaTransform();

      const result = transform({
        schema: {
          body: z.object({ name: z.string() }),
        },
        url: '/test',
        route: { method: 'GET', url: '/test', handler: () => ({ name: 'test' }) },
        openapiObject: {},
      });

      expect(result.schema.body).toMatchObject({ type: 'object' });
      // Defaults to 3.0, so $schema should be stripped
      expect(result.schema.body).not.toHaveProperty('$schema');
    });
  });

  describe('end-to-end bug fixes', () => {
    it('z.null in unions handled correctly for OAS 3.0 (#192)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/nullable-union',
        {
          schema: {
            response: {
              200: z.object({
                // z.nullable() is the idiomatic way to express nullable in Zod
                value: z.string().nullable(),
              }),
            },
          },
        },
        () => ({ value: null }),
      );

      await app.ready();
      const spec = app.swagger();
      const valueSchema = get(spec, [
        'paths',
        '/nullable-union',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'properties',
        'value',
      ]);

      expect(valueSchema).toMatchObject({ nullable: true });
      // Should not have type array — OAS 3.0 uses nullable: true instead
      expect(Array.isArray(valueSchema?.type)).toBe(false);
    });

    it('reused schemas inlined correctly for OAS 3.0 (#210)', async () => {
      const SharedTag = z.object({ label: z.string() });
      const ItemSchema = z.object({
        primary: SharedTag,
        secondary: SharedTag,
      });

      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/items',
        {
          schema: {
            response: { 200: ItemSchema },
          },
        },
        () => ({
          primary: { label: 'a' },
          secondary: { label: 'b' },
        }),
      );

      await app.ready();
      const spec = app.swagger();
      const responseSchema = get(spec, [
        'paths',
        '/items',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);

      // reused: "inline" means no $defs or definitions — schemas are inlined
      expect(responseSchema).toMatchObject({ type: 'object', properties: expect.anything() });
    });
  });

  describe('provider issues', () => {
    it('registered querystring schema generates valid params (#244)', async () => {
      const UserQuery = z.object({ name: z.string() }).meta({ id: 'UserQuery' });
      const UserSchema = z.object({ id: z.number(), name: z.string() }).meta({ id: 'User' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get(
        '/users',
        { schema: { querystring: UserQuery, response: { 200: z.array(UserSchema) } } },
        (_req, res) => {
          res.send([]);
        },
      );

      await app.ready();
      const spec = app.swagger();

      // Should not crash and should generate valid parameters
      const paramNames = get(spec, ['paths', '/users', 'get', 'parameters'])?.map(
        (p: Record<string, unknown>) => p.name,
      );
      expect(paramNames).toEqual(expect.arrayContaining(['name']));
    });

    it('z.transform() preserves type info in response schema (#208)', async () => {
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      await app.register(swagger, {
        openapi: {
          openapi: '3.1.0',
          info: { title: 'Test', version: '1.0.0' },
        },
        transform: jsonSchemaTransform,
      });

      app.after(() => {
        app.withTypeProvider<FastifyLorZodTypeProvider>().route({
          method: 'POST',
          url: '/',
          schema: {
            body: z.object({
              value: z.string(),
              transformed: z.string().transform((v) => v),
            }),
            response: {
              200: z.object({
                value: z.string(),
                transformed: z.string().transform((v) => v),
              }),
            },
          },
          handler: (_req, res) => {
            res.send({ value: 'a', transformed: 'b' });
          },
        });
      });

      await app.ready();
      const spec = app.swagger();

      // Response transformed field should NOT be empty {}
      const responseProps = get(spec, [
        'paths',
        '/',
        'post',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'properties',
      ]);

      expect(responseProps).toMatchObject({
        transformed: expect.objectContaining({ type: expect.anything() }),
      });
    });

    it('.meta({ id }) schemas populate components.schemas (#170)', async () => {
      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      const UserSchema = z.object({ id: z.number(), name: z.string() });
      z.globalRegistry.add(UserSchema, { id: 'User' });

      await app.register(swagger, {
        openapi: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, servers: [] },
        transform: jsonSchemaTransform,
        transformObject: jsonSchemaTransformObject,
      });

      app.after(() => {
        app.withTypeProvider<FastifyLorZodTypeProvider>().route({
          method: 'GET',
          url: '/users',
          schema: {
            response: { 200: z.array(UserSchema) },
          },
          handler: (_req, res) => {
            res.send([]);
          },
        });
      });

      await app.ready();
      const spec = app.swagger();

      // Response should reference the schema
      const items = get(spec, [
        'paths',
        '/users',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'items',
      ]);
      expect(items?.$ref).toBe('#/components/schemas/User');

      // Component should be populated
      expect(get(spec, ['components', 'schemas', 'User'])).toMatchObject({ type: 'object' });
    });

    it('.nullable().default(null) does not crash (#158)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.post(
        '/test',
        {
          schema: {
            body: z.object({
              value: z.string().nullable().default(null),
            }),
            response: {
              200: z.object({
                value: z.string().nullable().default(null),
              }),
            },
          },
        },
        (req, reply) => {
          reply.send({ value: req.body.value });
        },
      );

      await app.ready();
      // Should not throw
      const spec = app.swagger();
      expect(spec.paths).toBeDefined();
    });

    it('.optional().default() querystring produces valid params (#155)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/items',
        {
          schema: {
            querystring: z.object({
              limit: z.number().int().min(1).optional().default(10),
              offset: z.number().int().min(0).optional().default(0),
            }),
            response: { 200: z.array(z.object({ id: z.number() })) },
          },
        },
        (_req, reply) => {
          reply.send([]);
        },
      );

      await app.ready();
      const spec = app.swagger();

      const paramNames = get(spec, ['paths', '/items', 'get', 'parameters'])?.map(
        (p: Record<string, unknown>) => p.name,
      );
      expect(paramNames).toEqual(expect.arrayContaining(['limit', 'offset']));
    });

    it('z.json() schema definitions not lost (#210)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.post(
        '/data',
        {
          schema: {
            body: z.object({ data: z.json() }),
            response: { 200: z.object({ data: z.json() }) },
          },
        },
        (req, reply) => {
          reply.send({ data: req.body.data });
        },
      );

      await app.ready();
      const spec = app.swagger();

      // The body schema should have a resolvable $ref for z.json()
      const bodySchema = get(spec, [
        'paths',
        '/data',
        'post',
        'requestBody',
        'content',
        'application/json',
        'schema',
        'properties',
        'data',
      ]);

      // z.json() resolves to a $ref pointing to an auto-generated component schema
      expect(bodySchema).toBeDefined();
      expect(bodySchema.$ref).toBe('#/components/schemas/schema0');
    });

    it('nested content types supported (#227)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/download',
        {
          schema: {
            response: {
              200: {
                description: 'File content',
                content: {
                  'application/octet-stream': {
                    schema: z.string(),
                  },
                  'application/json': {
                    schema: z.object({ url: z.string() }),
                  },
                },
              },
            },
          },
        },
        (_req, reply) => {
          reply.send({ url: 'https://example.com' });
        },
      );

      await app.ready();
      const spec = app.swagger();

      const jsonSchema = get(spec, [
        'paths',
        '/download',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);

      expect(jsonSchema).toMatchObject({ type: 'object' });

      const octetSchema = get(spec, [
        'paths',
        '/download',
        'get',
        'responses',
        '200',
        'content',
        'application/octet-stream',
        'schema',
      ]);

      expect(octetSchema).toMatchObject({ type: 'string' });
    });

    it('anyOf with 3+ items preserved correctly (#195)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/multi',
        {
          schema: {
            response: {
              200: z.object({
                value: z.union([z.string(), z.number(), z.boolean()]),
              }),
            },
          },
        },
        () => ({ value: 'hello' }),
      );

      await app.ready();
      const spec = app.swagger();

      const valueSchema = get(spec, [
        'paths',
        '/multi',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
        'properties',
        'value',
      ]);

      // Should have anyOf with all 3 types preserved
      expect(valueSchema).toMatchObject({
        anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
      });
    });

    it('optional fields not shown as required in params (#148)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/search',
        {
          schema: {
            querystring: z.object({
              q: z.string(),
              page: z.number().optional(),
              sort: z.string().optional(),
            }),
          },
        },
        (_req, reply) => {
          reply.send({ results: [] });
        },
      );

      await app.ready();
      const spec = app.swagger();

      const params = get(spec, ['paths', '/search', 'get', 'parameters']);

      expect(params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'q', required: true }),
          expect.objectContaining({ name: 'page', required: false }),
          expect.objectContaining({ name: 'sort', required: false }),
        ]),
      );
    });

    it('excludes Input variants from components by default (#214)', async () => {
      const TokenSchema = z.string().length(12).meta({ id: 'Token' });

      const app = await buildAppWithSwagger('3.0.3');
      app.post(
        '/login',
        { schema: { body: z.object({ access_token: TokenSchema, refresh_token: TokenSchema }) } },
        (_req, res) => {
          res.send('ok');
        },
      );

      await app.ready();
      const spec = app.swagger();

      // Output variant should exist
      expect(get(spec, ['components', 'schemas', 'Token'])).toBeDefined();

      // Input variant should NOT exist (default is withInputSchema: false)
      expect(get(spec, ['components', 'schemas', 'TokenInput'])).toBeUndefined();
    });

    it('response description preserved from wrapper object (#47)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.get(
        '/health',
        {
          schema: {
            response: {
              200: {
                description: 'Healthy',
                properties: z.object({ status: z.boolean() }),
              },
            },
          },
        },
        () => ({ status: true }),
      );

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, ['paths', '/health', 'get', 'responses', '200'])).toMatchObject({
        description: 'Healthy',
      });
    });

    it('response description preserved when inner schema is registered (produces $ref)', async () => {
      const HealthSchema = z.object({ status: z.boolean() }).meta({ id: 'Health' });

      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      await app.register(swagger, {
        openapi: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } },
        transform: createJsonSchemaTransform(),
        transformObject: createJsonSchemaTransformObject(),
      });

      app.withTypeProvider<FastifyLorZodTypeProvider>().get(
        '/health',
        {
          schema: {
            response: {
              200: {
                description: 'Healthy',
                properties: HealthSchema,
              },
            },
          },
        },
        () => ({ status: true }),
      );

      await app.ready();
      const spec = app.swagger();

      const response = get(spec, ['paths', '/health', 'get', 'responses', '200']);
      expect(response.description).toBe('Healthy');

      const schema = get(response, ['content', 'application/json', 'schema']);
      expect(schema.$ref).toBe('#/components/schemas/Health');
    });

    it('registered schema response without description is unchanged', async () => {
      const ItemSchema = z.object({ id: z.number() }).meta({ id: 'Item' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get('/item', { schema: { response: { 200: ItemSchema } } }, () => ({ id: 1 }));

      await app.ready();
      const spec = app.swagger();

      expect(get(spec, ['components', 'schemas', 'Item'])).toBeDefined();

      const responseSchema = get(spec, [
        'paths',
        '/item',
        'get',
        'responses',
        '200',
        'content',
        'application/json',
        'schema',
      ]);
      expect(responseSchema).toMatchObject({ $ref: '#/components/schemas/Item' });
    });

    it('empty string description ignored for registered schema response', async () => {
      const PingSchema = z.object({ ok: z.boolean() }).meta({ id: 'Ping' });

      const app = await buildAppWithSwagger('3.0.3');
      app.get(
        '/ping',
        {
          schema: {
            response: {
              200: {
                description: '',
                properties: PingSchema,
              },
            },
          },
        },
        () => ({ ok: true }),
      );

      await app.ready();
      const spec = app.swagger();

      const response = get(spec, ['paths', '/ping', 'get', 'responses', '200']);

      // Empty string description must not appear in the OAS output
      expect(response?.description).not.toBe('');

      // Schema must be a bare $ref — no allOf wrapping (empty string treated as absent)
      expect(get(response, ['content', 'application/json', 'schema'])).toMatchObject({
        $ref: '#/components/schemas/Ping',
      });
    });

    it('body content type wrappers supported (#132)', async () => {
      const app = await buildAppWithSwagger('3.0.3');

      app.post(
        '/upload',
        {
          schema: {
            body: {
              content: {
                'application/json': {
                  schema: z.object({ name: z.string() }),
                },
                'text/plain': {
                  schema: z.string(),
                },
              },
            },
            response: {
              200: z.object({ ok: z.boolean() }),
            },
          },
        },
        () => ({ ok: true }),
      );

      await app.ready();
      const spec = app.swagger();

      const jsonSchema = get(spec, [
        'paths',
        '/upload',
        'post',
        'requestBody',
        'content',
        'application/json',
        'schema',
      ]);

      expect(jsonSchema).toMatchObject({ type: 'object' });

      const textSchema = get(spec, [
        'paths',
        '/upload',
        'post',
        'requestBody',
        'content',
        'text/plain',
        'schema',
      ]);

      expect(textSchema).toMatchObject({ type: 'string' });
    });
  });

  describe('createJsonSchemaTransforms', () => {
    it('auto-detects divergent schemas and generates Input variants', async () => {
      const schemaRegistry = z.registry<{ id: string }>();
      const UserSchema = z.object({ name: z.string(), role: z.string().default('user') });
      const ItemSchema = z.object({ id: z.number(), title: z.string() });
      schemaRegistry.add(UserSchema, { id: 'User' });
      schemaRegistry.add(ItemSchema, { id: 'Item' });

      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      await app.register(swagger, {
        openapi: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } },
        ...createJsonSchemaTransforms({ schemaRegistry }),
      });

      app.withTypeProvider<FastifyLorZodTypeProvider>().post(
        '/users',
        {
          schema: {
            body: UserSchema,
            response: { 200: ItemSchema },
          },
        },
        (_req, reply) => {
          reply.send({ id: 1, title: 'Widget' });
        },
      );

      await app.ready();
      const spec = app.swagger();

      // User has .default() → divergent → UserInput exists
      expect(get(spec, ['components', 'schemas', 'User'])).toBeDefined();
      expect(get(spec, ['components', 'schemas', 'UserInput'])).toBeDefined();

      // Item has no divergence → no ItemInput
      expect(get(spec, ['components', 'schemas', 'Item'])).toBeDefined();
      expect(get(spec, ['components', 'schemas', 'ItemInput'])).toBeUndefined();

      // Body ref uses Input variant
      expect(
        get(spec, [
          'paths',
          '/users',
          'post',
          'requestBody',
          'content',
          'application/json',
          'schema',
        ]),
      ).toMatchObject({ $ref: '#/components/schemas/UserInput' });

      // Response ref uses output variant
      expect(
        get(spec, [
          'paths',
          '/users',
          'post',
          'responses',
          '200',
          'content',
          'application/json',
          'schema',
        ]),
      ).toMatchObject({ $ref: '#/components/schemas/Item' });
    });

    it('withInputSchema: false suppresses all Input variants', async () => {
      const schemaRegistry = z.registry<{ id: string }>();
      const UserSchema = z.object({ name: z.string(), role: z.string().default('user') });
      schemaRegistry.add(UserSchema, { id: 'User' });

      const app = Fastify();
      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      await app.register(swagger, {
        openapi: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' } },
        ...createJsonSchemaTransforms({ schemaRegistry, withInputSchema: false }),
      });

      app
        .withTypeProvider<FastifyLorZodTypeProvider>()
        .post(
          '/users',
          { schema: { body: UserSchema, response: { 200: UserSchema } } },
          (_req, reply) => {
            reply.send({ name: 'Alice', role: 'user' });
          },
        );

      await app.ready();
      const spec = app.swagger();

      // withInputSchema: false → no Input variant even though schema diverges
      expect(get(spec, ['components', 'schemas', 'User'])).toBeDefined();
      expect(get(spec, ['components', 'schemas', 'UserInput'])).toBeUndefined();
    });
  });
});
