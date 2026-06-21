# Contributing

Thank you for contributing to this project. This monorepo uses **pnpm**, **Turbo**, and **Node 20+**.

## Development setup

1. Install prerequisites (see [README.md](./README.md)).
2. Copy `.env.example` to `.env` and adjust values.
3. Run `pnpm install`.
4. Start PostgreSQL with `docker compose up -d`, then `pnpm db:push`.
5. Use `pnpm dev:stack` for the recommended local workflow.

## Branch and commit conventions

- Create feature branches from `main`.
- Use clear commit messages focused on **why** the change was made.
- Keep pull requests scoped to a single concern when possible.

## Before opening a pull request

```bash
pnpm typecheck
pnpm build
```

If you changed the API, verify it starts with `pnpm dev:api`.

## Code style

- Match existing patterns in the package you are editing.
- TypeScript strictness is expected; avoid `any` unless justified.
- Do not commit secrets, `.env` files, or build artifacts (`dist/`, `node_modules/`).

## Project layout

See [docs/project-structure.md](./docs/project-structure.md) for an overview of apps, services, and shared packages.

## Questions

Open a GitHub issue for bugs or feature discussions before large refactors.
