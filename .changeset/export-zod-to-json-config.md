---
"fastify-lor-zod": minor
---

Export `ZodToJsonConfig` from the main entry point.

Previously consumers who wanted to type the `zodToJsonConfig` option in `SchemaTransformOptions` had to import it from an internal submodule. It is now available directly from `fastify-lor-zod`.
