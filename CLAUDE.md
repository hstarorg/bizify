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
- **`src/react/ViewModelBase.ts`** — extends core, adds `use(selector, equality?)` and `useDerived(fn, equality?)` which call zustand's React `useStore` internally. These are React hooks; only callable inside components. `use()` without a selector subscribes to the whole state and emits a dev-mode console warning.

Two view-binding APIs in `src/react/`:

- **`useViewModel(VM)`** — creates a new instance via `useState(() => new Ctor())`. Lifecycle calls go through a microtask-deferred reconciliation binding (see `src/react/lifecycleBinding.ts`) so `onMount` / `onUnmount` each fire **exactly once per logical mount**, even in React 18 StrictMode (which double-invokes effects in dev) or under discarded concurrent commits. For component-local state.
- **`createViewModelContext(VM)`** — returns `{ Provider, useVM }`. Provider creates one instance for its subtree (lifetime tied to Provider mount/unmount), uses the same lifecycle binding so StrictMode is invisible. Supports `initial` prop for SSR data injection (read once on first render). For shared state and SSR.

**Important — `dispose()` is NOT auto-called by either binding.** This keeps both bindings safe under React 18 StrictMode (which double-invokes effects in dev). Put view-tied cleanup in `onUnmount`. `onDispose` only fires when the user explicitly calls `vm.dispose()` (manual teardown, container/registry patterns, tests).

Key invariants:

- **`$set` is shallow merge**. Mutating nested state requires returning a new reference (`$set((s) => ({ items: [...s.items, x] }))`).
- **Method `this` is auto-bound at construction**. The base constructor walks the prototype chain (excluding `Object.prototype`) and re-defines each plain method as a non-enumerable bound own property. So both arrow class fields (`plus = () => ...`) and regular prototype methods (`plus() { ... }`) can be passed as handlers without losing `this`. Arrow fields shadow same-named prototype methods (own-property check skips). Auto-bind also covers inherited base-class methods like `dispose` and `$subscribe`.
- **Lifecycle hooks have empty defaults** — subclasses don't need `super.xxx()`.
- **`onMount` / `onUnmount` are coalesced** — they fire exactly once per real mount/unmount. The `lifecycleBinding` queues mount/unmount intent on a microtask and reconciles to the final desired state, so StrictMode's double-invoke and discarded concurrent commits collapse to a single lifecycle call. Subclass implementations don't need to be idempotent for StrictMode (but should still be reasonable for true unmount-then-remount via key change). Ref counting on the VM still exists for potential multi-binding scenarios but is rarely exercised in practice.
- **`dispose()` is idempotent**, sets a `disposed` flag that ignores subsequent `__mount`/`__unmount` calls. View bindings do NOT call it automatically.

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
- `test/createViewModelContext.test.tsx` — Provider sharing, initial injection (and read-once invariant), error when used outside Provider, lifecycle, StrictMode behavior

When changing public API, update both the type signatures AND the test that asserts the behavior.

## Documentation site

VitePress in `docs/`. Config at `docs/.vitepress/config.ts`. Output goes to `docs/.vitepress/dist`, deployed to gh-pages via `pnpm docs:deploy`. The site uses `base: '/bizify/'` because GitHub Pages serves it under that path.

Markdown content under `docs/guide/` — Chinese-first prose, English code identifiers. Don't translate API names.

## Notes

- React `>=18` is an **optional** peer dependency (`peerDependenciesMeta.optional: true`) so non-React consumers using only `bizify/core` don't get a peer warning.
- `tsconfig.json` uses `moduleResolution: Bundler` — required for `exports` field resolution. Don't change to `Node`.
- The husky `pre-commit` hook runs `lint-staged` which runs `oxlint --fix`. There's no commit-msg hook (commitlint was removed).
- `.oxlintrc.json` disables `react/react-in-jsx-scope` (React 17+ JSX runtime doesn't need React in scope).
