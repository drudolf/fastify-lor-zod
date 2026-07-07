---
"fastify-lor-zod": patch
---

Widen the peer dependency ranges and cap every major we test against: Fastify
`>=5.7.0 <6` (was `>=5.8.5`), fast-json-stringify `>=6.0.0 <8` (was `>=6.3.0`),
and @fastify/swagger `>=9.7.0 <10` (was `>=9.7.0`). A CI matrix verifies typecheck
and the test suite against the lowest and highest supported version of each peer.
The upper bounds stop consumers from silently pulling in an untested future major
(Fastify 6, fast-json-stringify 8, @fastify/swagger 10), matching the existing
`zod >=4.4.1 <5` cap.
