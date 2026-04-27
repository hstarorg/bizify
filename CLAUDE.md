# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Lerna + pnpm monorepo with two published packages:

- `packages/bizify-core` — view-framework-agnostic core. Exports `AbstractController`, `ControllerBase` (manual `$update`/`$updateByPath` via lodash.set), `ControllerBaseProxy` (Proxy-based reactive), and `ServiceWrapper` (async state).
- `packages/bizify` — React bindings. Re-exports `ControllerBaseProxy` from core and adds `useController` (hooks) and `buildClassController` (class components). Depends on `bizify-core` via `workspace:^`.

The `docs/` directory is a dumi documentation site (Chinese), built into `docs-dist/` and deployed to GitHub Pages.

## Common commands

Run from the repo root unless noted:

```bash
pnpm i                          # install all workspaces
pnpm dev                        # start dumi docs site (alias: pnpm start)
pnpm build                      # build both packages via father
pnpm build:core                 # build bizify-core only
pnpm test                       # lerna run test --stream (all packages)
pnpm test:core                  # run only bizify-core's jest suite
pnpm test:cov                   # coverage across packages
pnpm run pub                    # build then `lerna publish` (the `run` matters)
pnpm run pub:doc                # build docs and push docs-dist to gh-pages
```

Single package / single test:

```bash
# Run tests inside one package
pnpm --filter bizify test
pnpm --filter bizify-core test

# Run a single test file (jest pattern match on path)
pnpm --filter bizify-core exec jest ControllerBaseProxy

# Lint a single package (no root lint script)
pnpm --filter bizify lint        # lint:es + lint:css
```

Tests use ts-jest. `bizify-core` runs in `node` env; `bizify` runs in `jsdom` with `jest-setup.ts` (jest-dom matchers).

## Architecture

The library separates **business logic** (Controllers) from **view rendering**. The bridge is a single primitive on `AbstractController`:

```ts
$subscribe(subFn): () => void   // returns unsubscribe
```

A view binding (`useController`, `buildClassController`) calls `__init(options)` on the controller, subscribes for change events, and forces a re-render on each event. Unsubscribe runs on unmount.

Two controller flavors share that interface:

- **`ControllerBaseProxy<TData>`** (recommended, what docs teach): user implements `$data()` returning the initial state. `__init` wraps it in a recursive `Proxy` (lazy: child objects are proxied on first access and cached in a `WeakMap`). Any `set`/`delete` on `this.data` calls `emitChange()`, which emits `EventTypes.Change` on an internal `EventEmitter`. `$batchUpdate(fn)` suppresses intermediate emits and fires once at the end (also on throw, then rethrows).
- **`ControllerBase<TData>`** (manual): same `$data()` shape, but mutations go through `$update(part)` / `$updateByPath(path, value)` (lodash.set). It does not yet emit changes — treat as the simpler/legacy path.

Async work goes through **`$buildService(asyncFn)`** on `ControllerBaseProxy`, which returns a `ServiceWrapper` exposing `execute`, `loading`, `failed`, `loaded`, `data`, `error`. It tracks an in-flight request queue so out-of-order resolutions don't clobber the latest result, and notifies the controller (which re-emits change) on state transitions.

Conventions worth preserving:

- Define controller methods as **arrow function class fields** (`plus = () => { ... }`) so `this` stays bound when passed as event handlers — this is how all docs/examples are written.
- Mutate via `this.data.x = ...` directly; the Proxy handles reactivity. Don't reassign `this.data`.
- `emitChange` is an arrow function on purpose — it's passed into `ServiceWrapper` and must keep `this`.

## Build & release

- Both packages build with **father** (`father build`) into `dist/cjs` + `dist/esm` with `.d.ts`. `package.json` `files` ships `dist` minus `dist/__tests__`.
- Publishing is driven by **lerna** (`pnpm run pub`): builds first, then `lerna publish` bumps versions across both packages together (lerna.json pins a shared `version`). `*.md` and `**/__tests__/**` changes are ignored for version bumps.
- Husky enforces **commitlint (conventional commits)** on `commit-msg` and **lint-staged** (eslint + prettier + stylelint) on `pre-commit`. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Notes

- React `>=18` is a peerDependency of `bizify`; the dev docs site uses antd v4.
- Source comments and docs are largely in Chinese — preserve language when editing existing files.
- `packages/bizify-core/src/interalUtil.ts` is intentionally spelled this way (typo baked in); do not "fix" without coordinating, as it's referenced across the package.
