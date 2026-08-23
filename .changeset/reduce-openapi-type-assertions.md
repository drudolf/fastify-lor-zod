---
"fastify-lor-zod": patch
---

Reduce `as` type assertions in the OpenAPI transform layer by tightening types at
their source rather than casting at each use: a local `responseSchemas` accumulator,
an `isRecord` guard on the response slot, `Object.entries` for the extra-props loop,
a `content`-narrowed `isContentTypeWrapper` predicate, and an `isRecordArray` guard
in the OAS 3.0 downgrade. Internal refactor — no API or output change (100% coverage
preserved).
