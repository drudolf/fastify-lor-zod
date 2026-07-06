import { z } from 'zod';
import * as core from 'zod/v4/core';

/**
 * Signature shared by the fast and classic parse strategies.
 *
 * Mirrors `schema.safeParse(data)` so both strategies are drop-in
 * interchangeable inside the validator compiler.
 */
export type SafeParseFn = (schema: z.ZodType, data: unknown) => z.ZodSafeParseResult<unknown>;

/**
 * Zod tags its classes with trait names and checks `instanceof` via
 * `Symbol.hasInstance` against `_zod.traits` — prototype identity is not
 * required. Carrying both traits makes instances pass `instanceof z.ZodError`
 * and `instanceof core.$ZodError`. Shared read-only set, one allocation total.
 */
const ZOD_ERROR_TRAITS: ReadonlySet<string> = new Set(['$ZodError', 'ZodError']);

/**
 * ZodError-compatible validation error with lazy message construction.
 *
 * Classic `ZodError` construction eagerly pretty-prints all issues into
 * `message` and defines five per-instance closures — ~20µs per error. This
 * class defers the message to first access and keeps methods on the prototype,
 * matching the classic error's observable layout: own enumerable `name` and
 * `message`, own non-enumerable `issues` and `_zod`, captured `stack`.
 */
class LorZodError extends Error implements z.ZodError {
  // `type` and `_zod.output` satisfy `implements z.ZodError`; they are
  // type-level phantoms — Zod's own error initializer never assigns them
  // at runtime either. `_zod` is assigned via defineProperty in the
  // constructor with `def` and the `traits` set that drives instanceof.
  declare readonly type: unknown;
  declare readonly _zod: {
    output: unknown;
    def: core.$ZodIssue[];
    traits: ReadonlySet<string>;
  };
  declare readonly issues: core.$ZodIssue[];

  constructor(issues: core.$ZodIssue[]) {
    super();
    this.name = 'ZodError';
    Object.defineProperty(this, 'issues', { value: issues, enumerable: false });
    Object.defineProperty(this, '_zod', {
      value: { def: issues, traits: ZOD_ERROR_TRAITS },
      enumerable: false,
    });
    Object.defineProperty(this, 'message', {
      get: (): string => JSON.stringify(this.issues, core.util.jsonStringifyReplacer, 2),
      set: (value: string): void => {
        Object.defineProperty(this, 'message', {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      },
      enumerable: true,
      configurable: true,
    });
  }

  format(): core.$ZodFormattedError<unknown>;
  format<U>(mapper: (issue: core.$ZodIssue) => U): core.$ZodFormattedError<unknown, U>;
  format<U>(mapper?: (issue: core.$ZodIssue) => U): core.$ZodFormattedError<unknown, U> {
    return core.formatError(this, mapper);
  }

  flatten(): core.$ZodFlattenedError<unknown>;
  flatten<U>(mapper: (issue: core.$ZodIssue) => U): core.$ZodFlattenedError<unknown, U>;
  flatten<U>(mapper?: (issue: core.$ZodIssue) => U): core.$ZodFlattenedError<unknown, U> {
    return core.flattenError(this, mapper);
  }

  addIssue(issue: core.$ZodIssue): void {
    this.issues.push(issue);
  }

  addIssues(issues: core.$ZodIssue[]): void {
    this.issues.push(...issues);
  }

  get isEmpty(): boolean {
    return this.issues.length === 0;
  }

  override toString(): string {
    return this.message;
  }
}
Object.defineProperty(LorZodError, 'name', { value: 'ZodError' });

/**
 * Drop-in `safeParse` replacement that skips classic `ZodError` construction.
 *
 * Runs the parser core directly and, on failure, finalizes issues and wraps
 * them in a {@link LorZodError} — ~3x faster than `schema.safeParse` on the
 * error path, identical on success. Throws `core.$ZodAsyncError` for async
 * schemas, matching `safeParse` behavior.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw input to validate
 * @returns The same result shape as `schema.safeParse(data)`
 */
export const fastSafeParse: SafeParseFn = (schema, data) => {
  const payload = schema._zod.run({ value: data, issues: [] }, { async: false });
  if (payload instanceof Promise) throw new core.$ZodAsyncError();
  if (payload.issues.length > 0) {
    const config = core.config();
    const issues = payload.issues.map((issue) => core.util.finalizeIssue(issue, undefined, config));
    return { success: false, error: new LorZodError(issues) };
  }
  return { success: true, data: payload.value };
};

/**
 * Classic parse strategy — plain `schema.safeParse(data)`.
 *
 * Used as the fallback when {@link fastPathSelfCheck} fails, so behavior
 * degrades to stock Zod instead of breaking on internal API changes.
 */
export const classicSafeParse: SafeParseFn = (schema, data) => schema.safeParse(data);

/**
 * One-time round-trip check that the fast parse strategy is healthy on the
 * installed Zod version.
 *
 * Feature-detects the internal APIs the fast path relies on, then parses a
 * flat probe schema through the fast path and compares the outcome — success
 * data, error identity (`instanceof`), `name`, `message`, and `issues` —
 * against a `schema.safeParse` baseline. This guards the internal API
 * contract (`_zod.run`, `finalizeIssue`, traits), not every schema shape —
 * full behavioral parity is covered by the test suite. Any mismatch or throw
 * reports unhealthy.
 *
 * @param probeParse - Parse strategy to verify (injectable for tests)
 * @returns `true` when the fast path matches classic `safeParse` behavior
 */
export const fastPathSelfCheck = (probeParse: SafeParseFn = fastSafeParse): boolean => {
  try {
    const required: unknown[] = [
      core.util.finalizeIssue,
      core.util.jsonStringifyReplacer,
      core.config,
    ];
    if (required.some((fn) => typeof fn !== 'function')) return false;

    const probe = z.object({ probe: z.string() });
    const good = probeParse(probe, { probe: 'ok', stripped: true });
    if (!good.success || JSON.stringify(good.data) !== '{"probe":"ok"}') return false;

    const fast = probeParse(probe, { probe: 42 });
    const baseline = probe.safeParse({ probe: 42 });
    if (fast.success || baseline.success) return false;

    return (
      fast.error instanceof z.ZodError &&
      fast.error instanceof core.$ZodError &&
      fast.error instanceof Error &&
      fast.error.name === baseline.error.name &&
      fast.error.message === baseline.error.message &&
      JSON.stringify(fast.error.issues) === JSON.stringify(baseline.error.issues)
    );
  } catch {
    return false;
  }
};

/**
 * Picks the parse strategy for the validator compiler.
 *
 * Returns {@link fastSafeParse} when the self-check passed; otherwise emits a
 * single process warning and falls back to {@link classicSafeParse}.
 *
 * @param fastPathHealthy - Result of {@link fastPathSelfCheck}
 * @returns The parse strategy the validator should use
 */
export const selectParseStrategy = (fastPathHealthy: boolean): SafeParseFn => {
  if (fastPathHealthy) return fastSafeParse;
  process.emitWarning(
    '[fastify-lor-zod] Zod internals self-check failed — validator falling back to schema.safeParse (slower error construction).',
  );
  return classicSafeParse;
};
