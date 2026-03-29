import type {
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifyTypeProvider,
  RawServerDefault,
} from 'fastify';
import type z from 'zod';

/**
 * Resolves the handler return type for a response schema.
 *
 * Uses `z.input<T>` when output is a subtype of input and input is not `unknown`
 * (plain schemas and schemas with `.default()` — makes defaulted fields optional).
 * Falls back to `z.output<T>` for codec schemas (where `Date` diverges from `string`)
 * and for `z.preprocess` schemas (where input is `unknown`).
 */
type SerializerType<T extends z.ZodType> =
  z.output<T> extends z.input<T>
    ? unknown extends z.input<T>
      ? z.output<T>
      : z.input<T>
    : z.output<T>;

/**
 * Fastify type provider that integrates Zod v4 for schema validation and serialization.
 *
 * The `validator` maps to `z.output` so request handlers receive the validated/transformed
 * output type. The `serializer` uses `z.input` when `output extends input` (plain schemas
 * and schemas with `.default()`), making defaulted fields optional in handler return types —
 * returning `undefined` for such a field lets Zod apply the default during serialization.
 * For codec schemas where `output` diverges from `input` (e.g. `Date` vs `string`), the
 * serializer maps to `z.output` so handlers return the domain type for encoding.
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
  readonly serializer: this['schema'] extends z.ZodType ? SerializerType<this['schema']> : unknown;
}

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
