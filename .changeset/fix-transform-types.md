---
"fastify-lor-zod": patch
---

Fix incorrect TypeScript types for `jsonSchemaTransform` and `jsonSchemaTransformObject`. Both functions now correctly declare `SwaggerTransform<Schema>` and `SwaggerTransformObject` return types (imported from `@fastify/swagger`), removing the need for `@ts-expect-error` suppressions when registering the swagger plugin.
