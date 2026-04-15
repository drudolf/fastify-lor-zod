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

/** Flattens mapped/intersection types so editor hovers stay readable. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};
/** Zod object shapes map string keys to Zod schemas. */
type SchemaShape = Record<string, z.ZodType>;

/** Keys whose schema wrapper makes the field optional at serializer input time. */
type OptionalSchemaKeys<Shape extends SchemaShape> = {
  [K in keyof Shape]: Shape[K] extends
    | z.ZodOptional<z.ZodType>
    | z.ZodExactOptional<z.ZodType>
    | z.ZodDefault<z.ZodType>
    | z.ZodPrefault<z.ZodType>
    ? K
    : never;
}[keyof Shape];

/** Complement of {@link OptionalSchemaKeys}; emitted as required serializer fields. */
type RequiredSchemaKeys<Shape extends SchemaShape> = Exclude<
  keyof Shape,
  OptionalSchemaKeys<Shape>
>;

/** Recursively maps an object schema shape to the handler payload expected by `reply.send()`. */
type ObjectSerializerType<Shape extends SchemaShape> = Simplify<
  { [K in RequiredSchemaKeys<Shape>]: SerializerType<Shape[K]> } & {
    [K in OptionalSchemaKeys<Shape>]?: Exclude<SerializerType<Shape[K]>, undefined>;
  }
>;

/** Arrays preserve their container shape while remapping each item schema. */
type ArraySerializerType<Item extends z.ZodType> = SerializerType<Item>[];
/** Fixed tuple items preserve positional typing while remapping each element schema. */
type FixedTupleSerializerType<Items extends readonly z.ZodType[]> = {
  [K in keyof Items]: SerializerType<Items[K]>;
};
/** Tuples preserve fixed items and an optional rest tail. */
type TupleSerializerType<Items extends readonly z.ZodType[], Rest> = Rest extends z.ZodType
  ? [...FixedTupleSerializerType<Items>, ...SerializerType<Rest>[]]
  : FixedTupleSerializerType<Items>;
/** Unions/discriminated unions expose the union of each branch's serializer shape. */
type UnionSerializerType<Options extends readonly z.ZodType[]> = SerializerType<Options[number]>;
/** Records preserve the key shape of Zod's input type while remapping value schemas. */
type RecordSerializerType<Key extends z.ZodType<PropertyKey>, Value extends z.ZodType> = Simplify<{
  [K in keyof z.input<z.ZodRecord<Key, Value>>]: SerializerType<Value>;
}>;
/** Intersections require values satisfying both serializer shapes simultaneously. */
type IntersectionSerializerType<A extends z.ZodType, B extends z.ZodType> = SerializerType<A> &
  SerializerType<B>;
/** Non-codec pipes delegate to their output schema for serializer resolution. */
type PipeSerializerType<Out extends z.ZodType> = SerializerType<Out>;

/**
 * Wrapper schemas mostly forward serializer behavior from their inner schema,
 * while preserving wrapper-specific null/undefined/readonly adjustments.
 */
type WrapperSerializerType<T extends z.ZodType> =
  T extends z.ZodOptional<infer Inner extends z.ZodType>
    ? SerializerType<Inner> | undefined
    : T extends z.ZodExactOptional<infer Inner extends z.ZodType>
      ? SerializerType<Inner> | undefined
      : T extends z.ZodDefault<infer Inner extends z.ZodType>
        ? SerializerType<Inner> | undefined
        : T extends z.ZodPrefault<infer Inner extends z.ZodType>
          ? SerializerType<Inner> | undefined
          : T extends z.ZodNonOptional<infer Inner extends z.ZodType>
            ? Exclude<SerializerType<Inner>, undefined>
            : T extends z.ZodNullable<infer Inner extends z.ZodType>
              ? SerializerType<Inner> | null
              : T extends z.ZodReadonly<infer Inner extends z.ZodType>
                ? Readonly<SerializerType<Inner>>
                : T extends z.ZodLazy<infer Inner extends z.ZodType>
                  ? SerializerType<Inner>
                  : never;

/** Fallback rule for schemas we don't special-case: prefer parse input, unless it is `unknown`. */
type FallbackSerializerType<T extends z.ZodType> =
  unknown extends z.input<T> ? z.output<T> : z.input<T>;

/**
 * Resolves the handler return type for a response schema.
 *
 * Uses `z.output<T>` for codec schemas, since serializers call `safeEncode` and handlers
 * should return the domain/output type.
 *
 * Uses `z.output<T>` for `z.preprocess` schemas where `z.input<T>` is `unknown`, since
 * exposing `unknown` as the handler return type would erase useful typing.
 *
 * Uses `z.input<T>` for all other schemas, including one-way transforms. Runtime response
 * serialization for non-codec schemas uses `safeParse`, so handlers must return the schema's
 * parse input shape.
 */
type SerializerType<T extends z.ZodType> = T extends z.ZodCodec
  ? z.output<T>
  : T extends z.ZodPipe<z.ZodType, infer Out extends z.ZodType>
    ? PipeSerializerType<Out>
    : T extends z.ZodJSONSchema
      ? z.output<T>
      : T extends z.ZodObject<infer Shape extends SchemaShape, infer _Config>
        ? ObjectSerializerType<Shape>
        : T extends z.ZodArray<infer Item extends z.ZodType>
          ? ArraySerializerType<Item>
          : T extends z.ZodTuple<infer Items extends readonly z.ZodType[], infer Rest>
            ? TupleSerializerType<Items, Rest>
            : T extends z.ZodUnion<infer Options extends readonly z.ZodType[]>
              ? UnionSerializerType<Options>
              : T extends z.ZodDiscriminatedUnion<
                    infer Options extends readonly z.ZodType[],
                    string
                  >
                ? UnionSerializerType<Options>
                : T extends z.ZodRecord<
                      infer Key extends z.ZodType<PropertyKey>,
                      infer Value extends z.ZodType
                    >
                  ? RecordSerializerType<Key, Value>
                  : T extends z.ZodIntersection<
                        infer A extends z.ZodType,
                        infer B extends z.ZodType
                      >
                    ? IntersectionSerializerType<A, B>
                    : [WrapperSerializerType<T>] extends [never]
                      ? FallbackSerializerType<T>
                      : WrapperSerializerType<T>;

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

/** Response content wrappers mirror route-level serializer inference across each MIME entry. */
type ContentSchemaSerializer<T> = T extends { content: infer C }
  ? C[keyof C] extends { schema: infer S extends z.ZodType }
    ? SerializerType<S>
    : unknown
  : unknown;

/**
 * Fastify type provider that integrates Zod v4 for schema validation and serialization.
 *
 * The `validator` maps to `z.output` so request handlers receive the validated/transformed
 * output type. For body schemas with content-type wrappers (`{ content: { mime: { schema } } }`),
 * the validator extracts the union of all inner schema output types.
 *
 * The `serializer` uses structural recursion to resolve each field independently:
 * codec fields map to `z.output` (the domain type for encoding via `safeEncode`),
 * transform fields map to `z.input` (the parse input for `safeParse`), and
 * `.default()` / `.optional()` fields become optional in handler return types so
 * Zod can apply defaults during serialization.
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
  readonly validator: this['schema'] extends z.ZodType
    ? z.output<this['schema']>
    : ContentSchemaOutput<this['schema']>;
  readonly serializer: this['schema'] extends z.ZodType
    ? SerializerType<this['schema']>
    : ContentSchemaSerializer<this['schema']>;
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
