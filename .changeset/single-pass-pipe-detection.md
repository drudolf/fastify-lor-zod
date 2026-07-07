---
'fastify-lor-zod': patch
---

perf: detect codecs and transforms in one schema traversal at route registration

Simplification of the serializer compile path: the two independent tree
traversals (`hasCodecInTree`, `hasTransformInTree`) are replaced by a single
`pipeKindsInTree` walk with one WeakMap cache and frozen results — two files
and a generic predicate factory deleted. Identical detection semantics; route
registration for response schemas is roughly twice as fast in the detection
step (~18µs saved per schema in isolation).
