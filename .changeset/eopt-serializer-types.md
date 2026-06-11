---
"fastify-lor-zod": patch
---

Serializer types are now exactOptionalPropertyTypes-safe: plain optional and
default/prefault response properties accept zod's undefined-inclusive output
inference, while z.exactOptional() properties still reject explicit undefined.
The package itself now compiles with exactOptionalPropertyTypes enabled.
