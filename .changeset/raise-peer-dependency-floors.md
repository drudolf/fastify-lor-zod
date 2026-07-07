---
"fastify-lor-zod": minor
---

Raise minimum peer dependency versions: Fastify `>=5.10.0` (was `>=5.8.5`) and
fast-json-stringify `>=7.0.0` (was `>=6.3.0`). fast-json-stringify 7 is a new
major and is required only if you use `fastSerializerCompiler`; the default and
parse serializers do not depend on it.
