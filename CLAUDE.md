# CLAUDE.md

## Project overview

fastify-lor-zod — a Fastify type provider that integrates Zod v4 for schema validation, response serialization, and type-safe route definitions with OpenAPI support.

## Tech stack

- TypeScript (strict mode), ES modules (`"type": "module"`)
- Fastify v5, Zod v4, @fastify/swagger (optional peer dep)
- lodash-es (runtime dep), fast-json-stringify (dev dep for fast serializer)

## Development commands

- `pnpm install` — install dependencies
- `pnpm build` — build the project
- `pnpm test` — run tests
- `pnpm test:coverage` — run tests with 100% coverage enforcement
- `pnpm vitest run <path> -t "<pattern>"` — run specific tests
- `pnpm check` — run Biome (lint + format)
- `pnpm check:fix` — auto-fix Biome issues
- `pnpm knip` — detect unused exports, dependencies, and files
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm bench` — run benchmarks (vitest bench)
- `pnpm changeset` — create a changeset for versioning

## Test-spec workflow

Tests follow a spec-first workflow enforced by tooling:

1. Write `- [ ] test name` in `test-spec.md` first
2. `pnpm test:scaffold` — generates `it.todo()` stubs in the correct test file
3. Implement the test, replacing `.todo` with the real body
4. Mark `- [x]` in `test-spec.md`

Enforcement:

- `pnpm test:spec-check` — verify spec ↔ test alignment (runs vitest)
- `pnpm test:spec-check --no-run` — fast file-based check (pre-commit hook)
- `pnpm test:spec-check --strict` — also fail on `it.todo()` (CI on main)

Test names in `test-spec.md` must exactly match the `it('...')` strings.

**Parallel agent rule**: When multiple agents work in parallel, `test-spec.md` is append-only. Add new entries at the bottom of the relevant section — never edit or reorder existing lines. Conflicts are then trivially auto-resolvable at merge. Only the orchestrator (Picard) reorganizes the file.

## Linting and formatting

- **Biome** for linting and formatting
- **Knip** for detecting unused exports, dependencies, types, and files
- **husky + lint-staged** for pre-commit enforcement (config in `.lintstagedrc.json`, not `package.json`)
- All code must pass linting, formatting, and knip checks before commit
- Never disable lint rules inline without justification
- Run `pnpm typecheck`, `pnpm check` and `pnpm knip` before submitting changes

## Commit conventions

- **commitlint** with **@commitlint/config-conventional** enforced via husky commit-msg hook
- Follow Conventional Commits format: `type(scope): description`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `poc`
- Keep subject line under 72 characters
- Use imperative mood in the subject (`add` not `added`)

## Versioning and releases

- **Changesets** (`@changesets/cli`) for version management and changelog generation
- Every user-facing change (feat, fix, perf) must include a changeset
- Run `pnpm changeset` to create a changeset describing the change and its semver impact

## CI

CI must run all of the following — nothing merges without passing:

- `pnpm check`
- `pnpm knip`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:spec-check`
- `pnpm test:spec-check --strict` (main branch only — blocks `it.todo()`)

## Coding standards

- All code in TypeScript — never JavaScript
- No `console.log` or `debugger` in production code or tests (allowed in `scripts/`)
- No `any` types — use `unknown` and narrow with type guards
- Prefer Zod schemas for all validation; never validate manually
- Export types alongside schemas where consumers need them
- Use explicit return types on public API functions

## Documentation

- All public exports must have TSDoc comments
- Include `@param`, `@returns`, and `@example` tags where applicable
- Keep descriptions concise — one sentence for simple utilities, a short paragraph for complex behavior

## Dependencies

- Keep dependencies minimal — this is a library
- Fastify and Zod must be **peer dependencies**, not direct dependencies
- Avoid adding dependencies when the standard library or existing deps suffice
- Pin exact versions for all dependencies (enforced by syncpack)

## Error handling

- Use Fastify's built-in error handling (`reply.code().send()`) — do not throw raw errors
- Zod validation errors must map to HTTP 400 responses with structured error details
- Never swallow errors silently

## Testing

- Features without tests are incomplete
- Every bug fix needs a regression test
- Test both success and failure scenarios
- Test edge cases: empty input, invalid types, missing fields
- Keep tests focused — one behavior per test
- 100% code coverage enforced via vitest V8 provider

## Code style

- Arrow functions everywhere — no function declarations or function expressions
- Handle error case first (guard clauses) — early return/throw, happy path last
- Use `const` by default, `let` only when reassignment is necessary
- Prefer named exports over default exports
- Keep files focused — one concern per file
- No `@ts-expect-error` as a shortcut — fix the actual types instead

## Custom errors (ES2022+)

- `override readonly name = 'ErrorName' as const`
- `readonly code = 'ERR_...' as const` for programmatic matching
- Accept `ErrorOptions` param, forward to `super()` for cause chaining
- No `Object.setPrototypeOf`, no `Error.captureStackTrace` — unnecessary with ES2022+ targets
- Export error classes as public API

## Worktree workflow

- For any non-trivial code change, suggest entering a worktree before starting work
- Name worktrees using the same type prefixes as Conventional Commits: `feat-`, `fix-`, `refactor-`, `chore-`, `docs-`, `perf-`, `test-`, `ci-`, `poc-`
- Format: `<type>-<short-description>` using lowercase kebab-case (e.g. `feat-auto-input-detection`, `fix-schema-path`)
- Propose the worktree name as part of the suggestion so the user can confirm or adjust before entering

## Information gathering

- Use the `gh` CLI to fetch GitHub data (issues, PRs) — do not guess or assume
- Read existing code before proposing changes
- Check related tests before modifying a module
