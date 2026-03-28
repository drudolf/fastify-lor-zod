---
"fastify-lor-zod": patch
---

Fix broken `$ref`s for registered body schemas when `withInputSchema` is `false` (the default).

Previously, registered schemas used as request bodies always generated `$ref`s pointing to `{Id}Input` components, but those components are only added when `withInputSchema: true`. This produced invalid OpenAPI specs by default.

Now, `withInputSchema` consistently controls both the component generation and the `$ref` naming: `false` (default) uses the output schema name for all `$ref`s; `true` uses `{Id}Input` for body `$ref`s and adds both variants to `components.schemas`.
