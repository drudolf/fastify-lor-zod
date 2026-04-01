---
'fastify-lor-zod': minor
---

### Features

- Support Node.js >= 22 (previously required >= 24)
- `RouteHandler` type utility for defining handlers in separate files with full Zod type inference
- `error.input` on `RequestValidationError` for debugging validation failures
- Content-type aware body type inference for `{ content: { mime: { schema } } }` wrappers
- Auto-detect input schema variants (deprecates `withInputSchema`)

### Fixes

- Fix trailing slash in `schemaPath` for root-level validation errors
- Fix OAS 3.0 key stripping for `additionalProperties` and `definitions`
- Remove schema details from `ResponseSerializationError.message` (security)
- Improve error messages with library prefix and actionable context

### Other

- Remove dead `isObject` utility
- Rename `errors.ts` to `error.ts` in validator and serializer
- Clean up CHANGELOG duplicate entries
- Exclude test artifacts and declaration maps from npm package
- Add Node 22 to CI matrix
