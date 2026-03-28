# CLAUDE.md

## Project overview

fastify-zod-provider — a Fastify type provider that integrates Zod for schema validation and type-safe route definitions.

## Tech stack

- TypeScript (strict mode)
- Fastify
- Zod
- ES modules (`"type": "module"`)

## Development commands

- `pnpm install` — install dependencies
- `pnpm build` — build the project
- `pnpm test` — run tests
- `pnpm vitest run` — run tests once (CI mode)
- `pnpm vitest run <path> -t "<pattern>"` — run specific tests
- `pnpm check` — run Biome (lint + format)
- `pnpm check:fix` — auto-fix Biome issues
- `pnpm lint` — run Biome linter only
- `pnpm format` — format code with Biome
- `pnpm format:check` — check formatting without writing
- `pnpm knip` — detect unused exports, dependencies, and files
- `pnpm changeset` — create a changeset for versioning

## Linting and formatting

- **Biome** for linting and formatting
- **Knip** for detecting unused exports, dependencies, types, and files
- **husky + lint-staged** for pre-commit enforcement
- All code must pass linting, formatting, and knip checks before commit
- Never disable lint rules inline without justification
- Run `pnpm typecheck`, `pnpm check` and `pnpm knip` before submitting changes

## Commit conventions

- **commitlint** with **@commitlint/config-conventional** enforced via husky commit-msg hook
- Follow Conventional Commits format: `type(scope): description`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Keep subject line under 72 characters
- Use imperative mood in the subject (`add` not `added`)

## Versioning and releases

- **Changesets** (`@changesets/cli`) for version management and changelog generation
- Every user-facing change (feat, fix, perf) must include a changeset
- Run `pnpm changeset` to create a changeset describing the change and its semver impact
- Changelogs are generated automatically from changesets on release

## CI

- CI must run all of the following — nothing merges without passing:
  - `pnpm check`
  - `pnpm knip`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm test`

## Coding standards

- All code in TypeScript — never JavaScript
- No `console.log` or `debugger` in production code or tests
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
- Pin exact versions for dev dependencies

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

## Code style

- Use `const` by default, `let` only when reassignment is necessary
- Prefer named exports over default exports
- Keep files focused — one concern per file
- Request permission before creating new files

## Information gathering

- Use the `gh` CLI to fetch GitHub data (issues, PRs) — do not guess or assume
- Read existing code before proposing changes
- Check related tests before modifying a module
