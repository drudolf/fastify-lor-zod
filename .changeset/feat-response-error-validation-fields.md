---
'fastify-lor-zod': minor
---

Expose `validation` and `validationContext` on `ResponseSerializationError`, mirroring the request-side error shape.

Response schema failures now carry a Fastify-compatible `validation: FastifySchemaValidationError[]` array — each entry's `schemaPath` is prefixed `#/body/<path>`. A new `validationContext = 'body' as const` field identifies the failing HTTP part, matching `RequestValidationError.validationContext`. Shared error handlers can now treat request and response validation errors uniformly via `error.validation` + `error.validationContext`.

`mapIssueToValidationError` relocated internally from `./validator/error.js` to `./utils/map-issue-to-validation-error.js`. The public export from the package root is unchanged — no consumer-visible break.
