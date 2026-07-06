# Test Specification

## Request Validation (`validator/validator.test.ts`) — 25 tests

- [x] Accepts valid querystring parameters
- [x] Accepts requests on routes without schema
- [x] Returns 400 on querystring validation error
- [x] Returns 400 on body validation error
- [x] Returns 400 on empty body validation error
- [x] Validates headers (#244)
- [x] Validates params (#244)
- [x] Uses undefined as httpPart fallback when not provided
- [x] Headers can be modified after validation (#209)
- [x] Exposes original input on validation error
- [x] Coerces single querystring value into array for z.array schema (#151)
- [x] Already-array querystring passes through unchanged (#151)
- [x] Coerces single value with optional array schema (#151)
- [x] Coerces single value with nullable array schema (#151)
- [x] Coerces single value with defaulted array schema (#151)
- [x] Coerces single value with refined array min length (#151)
- [x] Coerces single value through element coercion (#151)
- [x] Coerces multiple single-value array fields in one request (#151)
- [x] Does not coerce when schema expects non-array (#151)
- [x] Does not coerce tuple single values (#151)
- [x] Coerces single header value into array (#151)
- [x] Coerces single params value into array (#151)
- [x] Does not coerce body single value to array (#151)
- [x] Does not false-coerce when union matches non-array branch (#151)
- [x] Does not coerce nested array path (#151)

## Serialization (`serializer/serializer.test.ts`) — 39 tests

Three serializer compilers: `safeEncode` (default, codec support), `safeParse` (validation, no codecs), `fast` (fast-json-stringify, no validation).

### Serializer-agnostic (×3 serializers = 18 tests)

- [x] Returns 204 with empty response schema
- [x] Returns 200 on correct string response
- [x] Returns 200 on correct object response
- [x] Handles nested schemas
- [x] falls back to JSON.stringify for non-Zod response schemas
- [x] Strips extra fields not in schema

### Validation errors — safeEncode + safeParse only (×2 = 10 tests)

- [x] Throws 500 on non-empty response with 204 schema
- [x] Returns 500 on incorrect string response
- [x] Returns 500 on incorrect object response
- [x] returns 500 when required field is missing from response
- [x] response validation error exposes #/body/<path> schemaPath

### Default values — safeEncode + safeParse only (×2 = 2 tests)

- [x] applies default value for omitted field in response schema

### safeEncode only — 8 tests

- [x] serializer uses encode for codec schemas
- [x] serializer uses encode for codec nested inside pipe
- [x] serializes transform response schemas via safeParse
- [x] rejects mixed codec and one-way transform response schemas with a clear error
- [x] allows codec alongside validation pipe without rejecting
- [x] Custom serializer replacer modifies JSON.stringify output
- [x] includes httpStatus in ResponseSerializationError
- [x] omits httpStatus from message when not provided

### Zod invariants — 1 test

- [x] captured safeParse behaves identically to method call

## Schema divergence detection (`utils/schema-diverges.test.ts`) — 27 tests

- [x] returns false for plain object schema
- [x] returns true for schema with transform
- [x] returns false for lazy schema without divergence
- [x] returns true for object with codec field
- [x] returns true for array of codec elements
- [x] returns true for optional codec
- [x] returns true for nullable codec
- [x] returns true for union with codec variant
- [x] returns true for deeply nested codec
- [x] returns true for tuple with codec element
- [x] returns true for record with codec value
- [x] returns true for lazy schema with codec
- [x] returns false for enum schema
- [x] returns true for intersection with codec side
- [x] returns false for intersection without divergence
- [x] returns false for map with codec value (unrepresentable in JSON Schema)
- [x] returns false for set with codec element (unrepresentable in JSON Schema)
- [x] returns true for discriminatedUnion with codec variant
- [x] returns false for plain pipe without transform
- [x] returns false for preprocess
- [x] returns true for object with default field
- [x] returns true for nested object with default
- [x] returns true for optional with default
- [x] returns false for nullable without default
- [x] returns false for optional without default
- [x] returns false for plain string
- [x] returns false for array of plain objects

## Error Handling (`validator/error.test.ts`) — 3 tests

- [x] Returns 400 with structured error on body validation error (method, url, validation details)
- [x] Produces empty instancePath for root-level validation errors
- [x] Stores input on RequestValidationError

## Error mapping (`utils/map-issue-to-validation-error.test.ts`) — 6 tests

- [x] maps issue path to instancePath
- [x] produces empty instancePath for root-level issue
- [x] includes httpPart in schemaPath
- [x] omits httpPart from schemaPath when undefined
- [x] escapes RFC 6901 special characters in path segments
- [x] spreads remaining issue properties into params

## OpenAPI/Swagger (`openapi/schema-transform.test.ts`) — 49 tests

### Spec generation — 19 tests

- [x] Generates OAS 3.0.3 spec correctly
- [x] Generates OAS 3.1.0 spec correctly
- [x] Rejects Swagger 2.0
- [x] Generates inline schemas (no refs)
- [x] Generates refs via z.registry
- [x] Generates refs via global registry
- [x] Handles nested and circular refs
- [x] Generates input and output schemas correctly
- [x] Generates referenced input and output schemas
- [x] Generates referenced schemas for registered schemas
- [x] Allows Zod target configuration for OAS 3.1
- [x] Handles all httpParts uniformly including params and querystring
- [x] Generates nullable types correctly for OAS 3.0 (#193)
- [x] Skips documentation routes by default
- [x] hides route when schema has hide: true
- [x] Allows zodToJsonConfig passthrough (#233)
- [x] Allows custom override to strip pattern from uuid (#233)
- [x] allows custom override to transform unsupported types
- [x] Handles readonly schemas (#71)

### Edge cases — 6 tests

- [x] Throws on non-Zod response schemas
- [x] Throws migration error for legacy { properties: ZodType } response wrapper
- [x] Passes through non-schema keys like tags and description
- [x] Defaults to OAS 3.0 when openapi version is not specified
- [x] transformObject rejects Swagger 2.0
- [x] passes through non-ZodType and non-object content entries

### End-to-end bug fixes — 2 tests

- [x] z.null in unions handled correctly for OAS 3.0 (#192)
- [x] Reused schemas inlined correctly for OAS 3.0 (#210)

### Other provider issues — 20 tests

- [x] Registered querystring schema generates valid params (#244)
- [x] z.transform() preserves type info in response schema (#208)
- [x] .meta({ id }) schemas populate components.schemas (#170)
- [x] .nullable().default(null) does not crash (#158)
- [x] .optional().default() querystring produces valid params (#155)
- [x] Optional fields not shown as required in params (#148)
- [x] z.json() schema definitions not lost (#210)
- [x] Nested content types supported (#227)
- [x] anyOf with 3+ items preserved correctly (#195)
- [x] excludes Input variants from components by default (#214)
- [x] body content type wrappers supported (#132)
- [x] registered schema without description has no response description
- [x] registered schema intrinsic description auto-lifts to response
- [x] registered schema intrinsic description not lifted in strict mode
- [x] chained .meta description lifts to response, component unchanged
- [x] inline schema .meta description lifts to response, removed from body
- [x] chained description overrides intrinsic component description
- [x] z.undefined response schema without .meta description passes through unchanged
- [x] z.undefined response schema with .meta description lifts description to response
- [x] same registered schema reused at multiple status codes gets independent descriptions

### createJsonSchemaTransforms — 2 tests

- [x] auto-detects divergent schemas and generates Input variants
- [x] withInputSchema: false suppresses all Input variants

## OpenAPI Snapshot (`openapi/openapi-snapshot.test.ts`) — 14 tests

Byte-identical snapshot output with turkerdev/fastify-type-provider-zod `fastify-swagger.spec.ts.snap`.

- [x] Generates types for fastify-swagger correctly (OAS 3.0.3)
- [x] Generates types for fastify-swagger with OAS 3.1.0 correctly
- [x] should fail generating types for fastify-swagger Swagger 2.0 correctly
- [x] Should not generate ref (inline schemas)
- [x] Should generate ref correctly using z.registry
- [x] Should generate ref correctly using global registry
- [x] Should generate nested and circular refs correctly
- [x] Should generate nullable arrays correctly
- [x] Should handle records within records
- [x] Should generate input and output schemas correctly
- [x] Should generate referenced input and output schemas correctly
- [x] should generate referenced input and output schemas correctly when referencing a registered schema
- [x] Should allow specification of Zod target to handle OpenAPI 3.1
- [x] Should generate Input variant schemas with withInputSchema: true

## OAS Converter (`openapi/zod-to-openapi.test.ts`) — 14 tests

- [x] Passes through schema for OAS 3.1
- [x] Removes OAS 3.0 incompatible keys
- [x] Recursively converts properties for OAS 3.0
- [x] Recursively converts items for OAS 3.0
- [x] Recursively converts anyOf entries for OAS 3.0
- [x] Recursively converts oneOf entries for OAS 3.0
- [x] Recursively converts allOf entries for OAS 3.0
- [x] Does not mutate original schema
- [x] Preserves $ref schemas as-is
- [x] recurses into additionalProperties for OAS 3.0
- [x] throws on unsupported OpenAPI version
- [x] isZodInternal returns true for a valid Zod schema
- [x] isZodInternal returns false for non-ZodType input
- [x] zodSchemaToJson throws if Zod internal API is absent

## Integration & Type Inference (`index.test.ts`) — 32 tests

- [x] Boots, handles requests, and produces a valid OpenAPI spec
- [x] Uses Zod codec encode for response serialization
- [x] Registered schemas appear as $ref components in OpenAPI spec
- [x] ResponseSerializationError is catchable via custom error handler
- [x] Typed plugin works with FastifyPluginAsyncZod
- [x] Infers types from schema when handler is defined separately
- [x] Infers body type from Zod schema
- [x] Infers querystring type from Zod schema
- [x] Infers params type from Zod schema
- [x] Infers headers type from Zod schema
- [x] Infers response type for reply.send()
- [x] Infers output type for schemas with defaults
- [x] Infers output type for schemas with transforms
- [x] Infers output type for response schemas with preprocess
- [x] Infers body type from content-type wrapper schema
- [x] Narrows reply type per status code via reply.code()
- [x] Infers request types in preHandler hook
- [x] infers response type from content-type wrapper schema
- [x] rejects tuples that mix codec and one-way transform elements
- [x] rejects unions that mix codec and one-way transform branches
- [x] infers output type for records with codec values
- [x] infers output type for intersections with codec-bearing branches
- [x] infers output type for tuples with codec rest elements
- [x] infers input type for tuples with transform rest elements
- [x] preserves constrained keys for records with codec values
- [x] preserves optional constrained keys for partial records with codec values
- [x] validates recursive discriminated-union request bodies
- [x] rejects invalid nodes nested deep inside recursive trees
- [x] serializes recursive discriminated-union responses
- [x] registered recursive schemas appear as self-referencing $ref components
- [x] optional response properties accept undefined-inclusive zod inference
- [x] exactOptional response properties reject explicit undefined

## OpenAPI Metaschema Validation (`openapi/openapi-metaschema.test.ts`) — 2 tests

- [x] Generated OAS 3.0.3 spec passes official metaschema validation
- [x] Generated OAS 3.1.0 spec passes official metaschema validation

## Fast safe parse (`validator/fast-safe-parse.test.ts`) — 17 tests

- [x] Fast-path error is instanceof ZodError, core $ZodError, and Error
- [x] Fast-path error has name ZodError and captured stack trace
- [x] Fast-path error message matches classic safeParse message exactly
- [x] Fast-path error issues deep-equal classic safeParse issues
- [x] Fast-path error format and flatten match classic safeParse error
- [x] Fast-path error isEmpty is false when issues exist
- [x] addIssue and addIssues update issues and lazy message reflects them
- [x] Assigning message overrides the lazy getter
- [x] JSON.stringify of fast-path error matches classic safeParse error layout
- [x] fastSafeParse returns parsed data on success
- [x] fastSafeParse strips unknown keys like safeParse
- [x] fastSafeParse throws ZodAsyncError on async schema
- [x] Self-check passes on the current zod version
- [x] Self-check fails when the fast parse is broken
- [x] Self-check fails when zod internals are missing
- [x] selectParseStrategy falls back to classic safeParse and emits a warning
- [x] selectParseStrategy returns the fast path without warning when healthy

## Pipe kinds detection (`utils/pipe-kinds-in-tree.test.ts`) — 8 tests

- [x] detects codec-only tree
- [x] detects transform-only tree
- [x] detects both kinds in a mixed tree in one traversal
- [x] returns neither flag for plain trees
- [x] classifies a pipe with both reverseTransform and transform out as codec only
- [x] caches result per schema and returns frozen object
- [x] handles recursive lazy schemas without infinite loop
- [x] handles non-ZodType input gracefully

**Total: 198 spec entries, 215 tests across 11 test files**
