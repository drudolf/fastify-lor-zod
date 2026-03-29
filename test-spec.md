# Test Specification

## Request Validation (`validator/validator.test.ts`) — 9 tests

- [x] Accepts valid querystring parameters
- [x] Accepts requests on routes without schema
- [x] Returns 400 on querystring validation error
- [x] Returns 400 on body validation error
- [x] Returns 400 on empty body validation error
- [x] Validates headers (#244)
- [x] Validates params (#244)
- [x] Uses undefined as httpPart fallback when not provided
- [x] Headers can be modified after validation (#209)

## Serialization (`serializer/serializer.test.ts`) — 25 tests

Three serializer compilers: `safeEncode` (default, codec support), `safeParse` (validation, no codecs), `fast` (fast-json-stringify, no validation).

### Serializer-agnostic (×3 serializers = 15 tests)

- [x] Returns 204 with empty response schema
- [x] Returns 200 on correct string response
- [x] Returns 200 on correct object response
- [x] Handles nested schemas
- [x] Strips extra fields not in schema

### Validation errors — safeEncode + safeParse only (×2 = 6 tests)

- [x] Throws 500 on non-empty response with 204 schema
- [x] Returns 500 on incorrect string response
- [x] Returns 500 on incorrect object response

### Default values — safeEncode + safeParse only (×2 = 2 tests)

- [x] applies default value for omitted field in response schema

### safeEncode only — 2 tests

- [x] serializer uses encode for codec schemas
- [x] Custom serializer replacer modifies JSON.stringify output

## Auto-detect codec (`has-codec-in-tree.test.ts`) — 15 tests

- [x] returns false for plain object schema
- [x] returns true for schema with transform (pipe in Zod v4)
- [x] returns false for lazy schema without codec
- [x] returns true for object with codec field
- [x] returns true for array of codec elements
- [x] returns true for optional codec
- [x] returns true for nullable codec
- [x] returns true for union with codec variant
- [x] returns true for deeply nested codec
- [x] returns true for tuple with codec element
- [x] returns true for record with codec value
- [x] returns true for lazy schema with codec
- [x] returns false for enum schema (options are primitives, not schemas)
- [x] returns false for non-ZodType input
- [x] handles circular schema without stack overflow

## Error Handling (`validator/errors.test.ts`) — 2 tests

- [x] Returns 400 with structured error on body validation error (method, url, validation details)
- [x] Produces empty instancePath for root-level validation errors

## Error mapping (`utils/error.test.ts`) — 6 tests

- [x] maps issue path to instancePath
- [x] produces empty instancePath for root-level issue
- [x] includes httpPart in schemaPath
- [x] omits httpPart from schemaPath when undefined
- [x] spreads remaining issue properties into params
- [x] maps multiple issues

## OpenAPI/Swagger (`openapi/schema-transform.test.ts`) — 36 tests

### Spec generation — 17 tests

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
- [x] Handles readonly schemas (#71)

### Edge cases — 5 tests

- [x] Throws on non-Zod response schemas
- [x] Passes through non-schema keys like tags and description
- [x] Defaults to OAS 3.0 when openapi version is not specified
- [x] transformObject rejects Swagger 2.0
- [x] passes through non-ZodType and non-object content entries

### End-to-end bug fixes — 2 tests

- [x] z.null in unions handled correctly for OAS 3.0 (#192)
- [x] Reused schemas inlined correctly for OAS 3.0 (#210)

### Other provider issues — 12 tests

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
- [x] response description preserved from wrapper object (#47)
- [x] response description preserved when inner schema is registered (produces $ref)
- [x] registered schema response without description is unchanged
- [x] empty string description ignored for registered schema response
- [x] body content type wrappers supported (#132)

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
- [x] does not recurse into additionalProperties for OAS 3.0
- [x] throws on unsupported OpenAPI version
- [x] isZodInternal returns true for a valid Zod schema
- [x] isZodInternal returns false for non-ZodType input
- [x] zodSchemaToJson throws if Zod internal API is absent

## Integration & Type Inference (`index.test.ts`) — 13 tests

- [x] Boots, handles requests, and produces a valid OpenAPI spec
- [x] Uses Zod codec encode for response serialization
- [x] Registered schemas appear as $ref components in OpenAPI spec
- [x] ResponseSerializationError is catchable via custom error handler
- [x] Typed plugin works with FastifyPluginAsyncZod
- [x] Infers body type from Zod schema
- [x] Infers querystring type from Zod schema
- [x] Infers params type from Zod schema
- [x] Infers headers type from Zod schema
- [x] Infers response type for reply.send()
- [x] Infers output type for schemas with defaults
- [x] Infers output type for schemas with transforms
- [x] Infers output type for response schemas with preprocess

## OpenAPI Metaschema Validation (`openapi/openapi-metaschema.test.ts`) — 2 tests

- [x] Generated OAS 3.0.3 spec passes official metaschema validation
- [x] Generated OAS 3.1.0 spec passes official metaschema validation

---

**Total: 136 tests across 10 test files**
