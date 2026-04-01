import type {
  ContextConfigDefault,
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifySchema,
  FastifyTypeProvider,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
  RouteHandlerMethod,
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
/**
 * Extracts the union of Zod output types from a content-type wrapper.
 *
 * Handles `{ content: { 'application/json': { schema: ZodType }, ... } }` by producing
 * a union of each inner schema's output type.
 */
type ContentSchemaOutput<T> = T extends { content: infer C }
  ? C[keyof C] extends { schema: z.ZodType }
    ? z.output<C[keyof C]['schema']>
    : unknown
  : unknown;

export interface FastifyLorZodTypeProvider extends FastifyTypeProvider {
  readonly validator: this['schema'] extends z.ZodType
    ? z.output<this['schema']>
    : ContentSchemaOutput<this['schema']>;
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

/**
 * Typed route handler with `FastifyLorZodTypeProvider` pre-configured.
 *
 * Use this to define handlers in separate files while preserving Zod type inference
 * from the schema. The handler's `req.params`, `req.body`, `req.query`, `req.headers`,
 * and return type are all inferred from the schema generic.
 *
 * @typeParam S - A Fastify schema object (e.g. `{ params: z.object(...), response: { 200: z.object(...) } }`)
 *
 * @example
 * ```ts
 * const schema = {
 *   params: z.object({ id: z.coerce.number() }),
 *   response: { 200: z.object({ name: z.string() }) },
 * } as const;
 *
 * const getUser: RouteHandler<typeof schema> = (req) => {
 *   req.params.id; // number
 *   return { name: 'Alice' };
 * };
 *
 * app.get('/users/:id', { schema }, getUser);
 * ```
 */
export type RouteHandler<S extends FastifySchema = FastifySchema> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  RouteGenericInterface,
  ContextConfigDefault,
  S,
  FastifyLorZodTypeProvider
>;
