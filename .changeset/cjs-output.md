---
"fastify-lor-zod": minor
---

Add CommonJS output alongside ESM. The package now ships both `dist/index.js` (ESM) and `dist/index.cjs` (CJS), with `"require"` and `"import"` conditions in the `exports` field and a `"main"` field for legacy consumers.
