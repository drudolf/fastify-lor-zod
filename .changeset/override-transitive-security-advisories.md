---
"fastify-lor-zod": patch
---

Harden the development dependency tree via `pnpm.overrides`, clearing the last two Dependabot advisories.

Pin patched transitive build/test dependencies: `fast-uri@3` → 3.1.5 (GHSA-7p8r-x3mc-p8w7) and `find-my-way@9` → 9.7.0 (GHSA-c96f-x56v-gq3h). Dev-scope only — `fastify` is a peer dependency and `pnpm.overrides` does not propagate to installs, so the published package and its consumers are unaffected.
