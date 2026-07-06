---
'fastify-lor-zod': patch
---

perf: share the `LorZodError` message accessor across instances to cut error-path GC pressure

The fast validator's lazy-message error previously defined its `message`
getter/setter as per-instance closures inside the constructor. Under error
load these two closures per error were promoted to old space alongside the
returned error, driving few-but-expensive major GCs — ~35x higher total GC
pause than the encode-based providers despite winning wall time.

The getter/setter are now shared module-level functions (dynamic `this`)
referenced through one frozen descriptor, so no per-instance closures are
allocated. `message` remains an own-enumerable accessor, so the observable
error shape is unchanged: `instanceof`, `name`, lazy message, setter override,
mutation reflection, and `JSON.stringify` layout all stay identical to classic
`ZodError`.

Measured (many-issue error path, `pnpm bench:memory`): GC pause per 20k
validations drops from ~150ms to ~4ms — now on par with the other providers —
while wall time also improves ~18%.
