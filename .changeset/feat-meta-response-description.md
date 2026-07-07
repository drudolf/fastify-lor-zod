---
'fastify-lor-zod': minor
---

**BREAKING:** the `{ description, properties: ZodSchema }` response wrapper is removed.
Use Zod v4's `.meta({ description: '...' })` directly on the response schema.

The schema-transform now lifts a response slot's `.meta({ description })` onto the
OAS response object (`responses.<code>.description`). Works for inline, registered,
and chained-on-registered schemas.

```ts
// Before
response: {
  200: { description: 'Healthy', properties: HealthSchema },
}

// After
response: {
  200: HealthSchema.meta({ description: 'Healthy' }),
}
```

Behavioral notes:

- For registered schemas with their own `.meta({ description })`, the description
  is also auto-lifted by default (the component's description doubles as the
  response label). Disable with the new `liftSchemaDescriptionToResponse: false`
  option on `createJsonSchemaTransform` for strict OAS semantics.
- The component's intrinsic description is never overwritten by route-level chains.
- Chaining `.meta({ description })` at the route slot always wins, even in strict
  mode, since the chained instance has no id of its own.

Side effects:

- Fixes upstream issue #212 — the serializer compiler types are restored from
  `FastifySerializerCompiler<ZodType | { properties: ZodType }>` (the union shape
  upstream blames for the ESLint `no-unsafe-argument` warning) back to the clean
  `FastifySerializerCompiler<z.ZodType>`.
- Routes that still use the legacy wrapper form throw a clear migration error at
  startup with a pointer to MIGRATION.md.
