# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture & design

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). When changing architecture, update that file — **do not grow this one with implementation details**.

## Repository overview

Single-package React MVVM library backed by valtio. Published as `bizify` with two entry points:

- `bizify` — React bindings (default entry)
- `bizify/core` — framework-agnostic ViewModel base

No monorepo, no Lerna, no workspaces.

## Common commands

```bash
pnpm install         # install
pnpm test            # vitest run (single pass)
pnpm test:watch      # vitest watch
pnpm test:cov        # coverage
pnpm typecheck       # tsc --noEmit
pnpm lint            # oxlint
pnpm lint:fix        # oxlint --fix
pnpm build           # clean + rolldown + tsc (emit .d.ts)
pnpm docs:dev        # VitePress local preview
pnpm docs:build      # VitePress production build
pnpm docs:deploy     # gh-pages deploy
```

Single test (vitest pattern match):

```bash
pnpm test -- core               # run tests matching "core"
pnpm test -- useViewModel       # specific file
```

## Where things live

- `src/core/` — framework-agnostic VM base
- `src/react/` — React bindings + lifecycle binding util
- `test/` — Vitest specs (jsdom env)
- `docs/` — VitePress site, deployed to GitHub Pages
- `ARCHITECTURE.md` — design rationale and invariants
- `rolldown.config.ts` / `tsconfig.build.json` / `vitest.config.ts` — build/test configs

## Conventions

- Tests use **explicit imports** (`import { describe, it, expect } from 'vitest'`), not globals
- Markdown content under `docs/guide/` is Chinese-first prose, English code identifiers — preserve language when editing
- The husky `pre-commit` hook runs `lint-staged` → `oxlint --fix`. No commit-msg hook.
- `tsconfig.json` uses `moduleResolution: Bundler`, required for the `exports` field. Don't change.

## Notes

- React `>=18` is an **optional** peer dependency so non-React consumers using only `bizify/core` don't get a peer warning.
- valtio's `subscribe` / `subscribeKey` are async (microtask). Tests asserting subscription side-effects must `await Promise.resolve()`.
