---
'fastify-lor-zod': patch
---

Fix missing README on npmjs.com — inject README content into package.json before publish so npm includes it in per-version registry metadata (workaround for npm 11+ regression).
