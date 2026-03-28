import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifyTypeProvider,
  RawServerDefault,
} from 'fastify';
import type { z } from 'zod';

/**
 * Fastify type provider that integrates Zod for schema validation and serialization.
 *
 * @example
 * ```ts
 * const app = fastify().withTypeProvider<FastifyLorZodTypeProvider>();
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
  createSerializerCompiler,
  type SerializerCompilerOptions,
  serializerCompiler,
} from './serializer.js';
export { validatorCompiler } from './validator.js';
export { jsonSchemaToOAS } from './zod-to-openapi.js';
/**
 * Typed Fastify plugin callback with `FastifyLorZodTypeProvider` pre-configured.
 *
 * @example
 * ```ts
 * const plugin: FastifyPluginCallbackZod = (app, opts, done) => {
 *   app.get("/", { schema: { response: { 200: z.object({ ok: z.boolean() }) } } }, (req, reply) => {
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
 * @example
 * ```ts
 * const plugin: FastifyPluginAsyncZod = async (app) => {
 *   app.get("/", { schema: { response: { 200: z.object({ ok: z.boolean() }) } } }, (req, reply) => {
 *     reply.send({ ok: true });
 *   });
 * };
 * ```
 */
export type FastifyPluginAsyncZod<Options extends FastifyPluginOptions = Record<never, never>> =
  FastifyPluginAsync<Options, RawServerDefault, FastifyLorZodTypeProvider>;
