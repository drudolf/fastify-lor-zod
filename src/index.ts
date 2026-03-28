import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifyTypeProvider,
  RawServerDefault,
} from 'fastify';
import type { z } from 'zod';

/**
 * Fastify type provider that integrates Zod v4 for schema validation and serialization.
 *
 * Both `validator` and `serializer` map to `z.output`, so request handlers receive
 * the validated/transformed output type, and `reply.send()` accepts the domain type
 * (the serializer handles encoding to wire format).
 *
 * @example
 * ```ts
 * const app = Fastify()
 *   .withTypeProvider<FastifyLorZodTypeProvider>();
 *
 * app.get('/user/:id', {
 *   schema: {
 *     params: z.object({ id: z.coerce.number() }),
 *     response: { 200: z.object({ id: z.number(), name: z.string() }) },
 *   },
 * }, (req) => ({ id: req.params.id, name: 'Alice' }));
 * //               ^ typed as number
 * ```
 */
export interface FastifyLorZodTypeProvider extends FastifyTypeProvider {
  readonly validator: this['schema'] extends z.ZodType ? z.output<this['schema']> : unknown;
  readonly serializer: this['schema'] extends z.ZodType ? z.output<this['schema']> : unknown;
}

export { RequestValidationError, ResponseSerializationError } from './errors.js';
export {
  createJsonSchemaTransform,
  createJsonSchemaTransformObject,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  type SchemaTransformOptions,
} from './schema-transform.js';
export {
  createFastSerializerCompiler,
  createParseSerializerCompiler,
  createSerializerCompiler,
  fastSerializerCompiler,
  parseSerializerCompiler,
  type SerializerCompilerOptions,
  serializerCompiler,
} from './serializer.js';
export { validatorCompiler } from './validator.js';
export { jsonSchemaToOAS } from './zod-to-openapi.js';
/**
 * Typed Fastify plugin callback with `FastifyLorZodTypeProvider` pre-configured.
 *
 * Use this instead of `FastifyPluginCallback` to get Zod type inference
 * inside callback-style plugins without manually calling `withTypeProvider`.
 *
 * @typeParam Options - Plugin options type (defaults to empty record)
 *
 * @example
 * ```ts
 * const plugin: FastifyPluginCallbackZod = (app, opts, done) => {
 *   app.get('/', {
 *     schema: { response: { 200: z.object({ ok: z.boolean() }) } },
 *   }, (req, reply) => {
 *     reply.send({ ok: true });
 *   });
 *   done();
 * };
 * ```
 */
export type FastifyPluginCallbackZod<Options extends FastifyPluginOptions = Record<never, never>> =
  FastifyPluginCallback<Options, RawServerDefault, FastifyLorZodTypeProvider>;

/**
 * Typed Fastify async plugin with `FastifyLorZodTypeProvider` pre-configured.
 *
 * Use this instead of `FastifyPluginAsync` to get Zod type inference
 * inside async plugins without manually calling `withTypeProvider`.
 *
 * @typeParam Options - Plugin options type (defaults to empty record)
 *
 * @example
 * ```ts
 * const plugin: FastifyPluginAsyncZod = async (app) => {
 *   app.get('/', {
 *     schema: { response: { 200: z.object({ ok: z.boolean() }) } },
 *   }, (req, reply) => {
 *     reply.send({ ok: true });
 *   });
 * };
 * ```
 */
export type FastifyPluginAsyncZod<Options extends FastifyPluginOptions = Record<never, never>> =
  FastifyPluginAsync<Options, RawServerDefault, FastifyLorZodTypeProvider>;
