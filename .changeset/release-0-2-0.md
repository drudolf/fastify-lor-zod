---
'fastify-lor-zod': minor
---

### Features

- **`RouteHandler` type utility** — define handlers in separate files while preserving full Zod type inference from the schema (`params`, `querystring`, `headers`, `body`, `response`)
- **`error.input` on `RequestValidationError`** — exposes the original data that failed validation for easier debugging in error handlers
- **Auto-detect input schema variants** — registered schemas with divergent input/output shapes (transforms, codecs, defaults) automatically get `{Id}Input` components in OpenAPI. The `withInputSchema` option is deprecated.

### Fixes

- Fixed Biome ignoring all files inside git worktrees
- Fixed missing README on npmjs.com (npm 11+ compatibility)

### Docs

- Simplified OpenAPI/Swagger README section
- Clarified when `transform` and `transformObject` are needed independently
