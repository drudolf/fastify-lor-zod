# Contributing

Thanks for your interest in contributing to fastify-lor-zod.

## Setup

```bash
git clone https://github.com/drudolf/fastify-lor-zod.git
cd fastify-lor-zod
nvm use          # or ensure Node >= 20
pnpm install
```

## Development

| Command | Description |
|---------|-------------|
| `pnpm test` | Run tests |
| `pnpm test:coverage` | Run tests with 100% coverage enforcement |
| `pnpm check` | Lint + format (Biome) |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm knip` | Detect unused exports and dependencies |
| `pnpm bench` | Run benchmarks against other type providers |
| `pnpm build` | Build ESM output |

## Test-first workflow

Tests follow a spec-first approach:

1. Add `- [ ] test name` to `test-spec.md`
2. Run `pnpm test:scaffold` to generate `it.todo()` stubs
3. Implement the test
4. Mark `- [x]` in `test-spec.md`
5. `pnpm test:spec-check` verifies alignment

## Pre-commit checks

The following run automatically on commit via husky + lint-staged:

- `biome check --write` on staged files
- `pnpm test:spec-check --no-run` (fast file-based spec validation)

## CI

All of the following must pass before merging:

- `pnpm check`
- `pnpm knip`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:spec-check`
- `pnpm test:spec-check --strict` (main only -- no `it.todo()` allowed)

## Conventions

- **Commits**: Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.)
- **Code style**: Arrow functions, guard clauses, no `any`, no `@ts-expect-error` shortcuts
- **Formatting**: Biome -- 2 spaces, single quotes
- **Changesets**: Every user-facing change needs a changeset (`pnpm changeset`)

See [CLAUDE.md](CLAUDE.md) for the full project conventions.

## Pull Requests

1. Fork and create a branch from `develop`
2. Make your changes with tests
3. Ensure all checks pass locally
4. Submit a PR against `develop`
