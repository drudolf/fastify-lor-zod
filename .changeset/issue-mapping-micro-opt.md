---
'fastify-lor-zod': patch
---

perf: skip RFC 6901 escaping when path segments contain no special characters

`mapIssueToValidationError` now builds the JSON pointer with a concatenation
loop and only runs the escape regexes when a segment actually contains `~` or
`/` — ~2.4x faster issue mapping on the validation error path. Output is
byte-identical.
