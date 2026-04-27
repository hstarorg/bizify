# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Single-package React MVVM library backed by zustand. Published as `bizify` with two entry points:

- `bizify` — React bindings (default entry)
- `bizify/core` — framework-agnostic ViewModel base

No monorepo, no Lerna, no workspaces. The whole library lives in `src/`.

## Common commands

```bash
pnpm install         # install
pnpm test            # vitest run (single pass)
pnpm test:watch      # vitest watch
pnpm test:cov        # coverage
pnpm typecheck       # tsc --noEmit
pnpm lint            # oxlint
pnpm lint:fix        # oxlint --fix
pnpm build           # rolldown + tsc (emit .d.ts)
pnpm docs:dev        # VitePress local preview
pnpm docs:build      # VitePress production build
pnpm docs:deploy     # gh-pages deploy
```

Single test (vitest pattern match):

```bash
pnpm test -- core               # run tests matching "core"
pnpm test -- useViewModel       # specific file
```

## Architecture

The library exposes one core abstraction: **`ViewModelBase`**, a class that pairs state (zustand store) with lifecycle hooks and React-aware subscription methods.

Two layers:

- **`src/core/ViewModelBase.ts`** — uses `zustand/vanilla`. Framework-agnostic: provides `$data()`, `$set`, `$subscribe`, lifecycle hooks (`onInit`/`onMount`/`onUnmount`/`onDispose`), ref-counted `__mount`/`__unmount`, idempotent `dispose()`. Does NOT contain React hooks.
- **`src/react/ViewModelBase.ts`** — extends core, adds `use(selector, equality?)` and `useDerived(fn)` which call zustand's React `useStore` internally. These are React hooks; only callable inside components.

Two view-binding APIs in `src/react/`:

- **`useViewModel(VM)`** — creates a new instance via `useState(() => new Ctor())`, runs `__mount` on first effect, `__unmount` + `dispose()` on unmount. For component-local state.
- **`createViewModelContext(VM)`** — returns `{ Provider, useVM }`. Provider creates one instance for its subtree (lifetime tied to Provider mount/unmount). Supports `initial` prop for SSR data injection. For shared state and SSR.

Key invariants:

- **`$set` is shallow merge**. Mutating nested state requires returning a new reference (`$set((s) => ({ items: [...s.items, x] }))`).
- **Method-as-arrow-class-field** is the convention (`plus = () => ...`) so `this` binds correctly when methods are passed as event handlers. All examples and tests use this pattern.
- **Lifecycle hooks have empty defaults** — subclasses don't need `super.xxx()`.
- **`onMount` / `onUnmount` use ref counting** — multiple subscribers share one VM, hooks fire on first mount / last unmount only.
- **`dispose()` is idempotent**, sets a `disposed` flag that ignores subsequent `__mount`/`__unmount` calls.

## Build pipeline

- **Rolldown** bundles JS:
  - Two inputs: `src/index.ts` (React) → `dist/index.{js,cjs}`, `src/core/index.ts` → `dist/core.{js,cjs}`
  - `react`, `react/jsx-runtime`, `zustand`, `zustand/vanilla`, `zustand/react/shallow` are external
  - Shared code between entries goes into `dist/chunks/`
- **tsc** (via `tsconfig.build.json`) emits `.d.ts` only into `dist/types/`, mirroring source layout
- `package.json` `exports` field maps `.` and `./core` to the right `.js`/`.cjs`/`.d.ts` files

If editing `package.json` exports or build config, run `pnpm build && pnpm pack --pack-destination /tmp` and `tar -tzf` the tarball to verify product paths.

## Tests

Vitest with jsdom + `@testing-library/react`. Setup file `test/setup.ts` adds jest-dom matchers. Tests use **explicit imports** (`import { describe, it, expect } from 'vitest'`) — not globals.

Three test files cover all public surface:

- `test/core.test.ts` — ViewModelBase semantics (state, $set, $subscribe, lifecycle, dispose, ref counting)
- `test/useViewModel.test.tsx` — React hook integration (mount, unmount, selector subscription, useDerived, shallow eq)
- `test/createViewModelContext.test.tsx` — Provider sharing, initial injection, error when used outside Provider, dispose on unmount

When changing public API, update both the type signatures AND the test that asserts the behavior.

## Documentation site

VitePress in `docs/`. Config at `docs/.vitepress/config.ts`. Output goes to `docs/.vitepress/dist`, deployed to gh-pages via `pnpm docs:deploy`. The site uses `base: '/bizify/'` because GitHub Pages serves it under that path.

Markdown content under `docs/guide/` — Chinese-first prose, English code identifiers. Don't translate API names.

## Notes

- React `>=18` is an **optional** peer dependency (`peerDependenciesMeta.optional: true`) so non-React consumers using only `bizify/core` don't get a peer warning.
- `tsconfig.json` uses `moduleResolution: Bundler` — required for `exports` field resolution. Don't change to `Node`.
- The husky `pre-commit` hook runs `lint-staged` which runs `oxlint --fix`. There's no commit-msg hook (commitlint was removed).
- `.oxlintrc.json` disables `react/react-in-jsx-scope` (React 17+ JSX runtime doesn't need React in scope).
