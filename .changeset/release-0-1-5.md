---
'fastify-lor-zod': patch
---

Auto-detect input schema variants: registered schemas with divergent input/output shapes (transforms, codecs, defaults) now automatically get `{Id}Input` components without configuration. The `withInputSchema` option is deprecated. Clarified when `transform` and `transformObject` are needed independently, and fixed Biome ignoring all files inside git worktrees.
