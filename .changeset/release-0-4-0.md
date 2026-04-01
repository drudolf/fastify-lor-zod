---
'fastify-lor-zod': minor
---

### BREAKING CHANGE: Validation error handling

`RequestValidationError` is no longer a class — it is now an interface. The validator compiler augments the ZodError directly instead of wrapping it in a custom Error, eliminating Error constructor overhead and matching turkerdev's end-to-end performance.

**Migration (one-line change):**

```diff
- import { RequestValidationError } from 'fastify-lor-zod';
+ import { isRequestValidationError } from 'fastify-lor-zod';

  app.setErrorHandler((error, request, reply) => {
-   if (error instanceof RequestValidationError) {
+   if (isRequestValidationError(error)) {
-     reply.code(400).send({ context: error.context, issues: error.validation });
+     reply.code(400).send({ context: error.validationContext, issues: error.validation });
    }
  });
```

**What changed:**
- `instanceof RequestValidationError` → `isRequestValidationError(error)` type guard
- `.context` → `.validationContext` (now set by Fastify, not by us)
- `.code` (`'ERR_REQUEST_VALIDATION'`) removed — Fastify sets `.code` to `'FST_ERR_VALIDATION'`
- `.input` and `.validation` remain unchanged

**Why:** Eliminates `new Error()` stack trace capture on every validation failure. End-to-end performance now matches turkerdev (previously 25% slower).
