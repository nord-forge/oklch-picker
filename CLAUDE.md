# oklch-picker

An OKLCH colour picker published as six packages: one shared core and five
framework adapters. Zero runtime dependencies.

## Layout

```
packages/
  core/       @oklch-picker/core     colour maths + headless model + stylesheet
  react/      @oklch-picker/react    also serves Preact via preact/compat
  vue/        @oklch-picker/vue
  svelte/     @oklch-picker/svelte   ships uncompiled .svelte source
  solid/      @oklch-picker/solid    ships JSX source
  vanilla/    oklch-picker           the <oklch-picker> custom element
test/         one suite per adapter, run from the repo root
examples/     one runnable app per adapter
```

`packages/vanilla` publishes under the **bare `oklch-picker` name**, not a
scoped one: someone who types `npm i oklch-picker` without naming a framework
wants the build that works anywhere. Its directory name still says `vanilla`
because that reads better next to its five siblings.

## Commands

```sh
npm run build       # all packages, in dependency order
npm test            # 113 tests across 5 vitest projects
npm run typecheck   # tsc + a second pass for Solid + svelte-check
npm run lint        # biome; lint:fix to write
npm run dev         # all six examples at once, ports 5272-5277
```

Run `npm run build` before the examples — they resolve each package's `dist/`,
not its source, so edits under `packages/*/src` need a rebuild to show up.

## Architecture

**Everything derives from `core`.** `colour.ts` is the maths; `model.ts` is the
headless model — axis ranges, track gradients, chart geometry, the draft/emit
resolution, and the chart memo key. `pickerModel()` returns everything a picker
needs for one render.

An adapter therefore contains only markup and state wiring, ~250 lines each.
**When you change behaviour, change `model.ts`** so all five adapters get it;
if you find yourself editing the same logic in two adapters, it belongs in the
core instead.

The exception is `vanilla` (~600 lines, the largest): with no virtual DOM it
builds nodes once and mutates them in place, because rebuilding the tree on
every input would drop focus from the slider mid-drag.

### Invariants worth preserving

- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing
  chroma, keeping lightness and hue.
- **The draft is not the stored value.** Dragging through an unreachable region
  clamps what is emitted; without `resolveCurrent`, reading that clamped value
  back would destroy the other axes. Tests cover the round trip.
- **Chart curves are memoised on one input.** A curve never reads chroma, and
  only one of the other two axes — see `chartKey`. Keying on that means dragging
  an unrelated slider reuses the path and its ~65 gradient stops.
- **The stylesheet is shared and class-based**, and every adapter honours
  `classPrefix`. It lives in `core`.

## Constraints that are easy to trip over

- **Solid and Svelte ship source, not builds.** Both ecosystems expect the
  consumer's compiler to handle it. For Solid this is not just convention: one
  tsconfig cannot hold two JSX settings, so bundling it here compiles its JSX
  with React's runtime and the output imports `react`. Solid has its own
  `tsconfig.json` and its own `tsc` pass.
- **`sideEffects` must list the register entry.** `packages/vanilla` declares
  `./dist/register.mjs`; without it, bundlers tree-shake the
  `customElements.define` call away and the element silently never upgrades.
- **The vanilla element stops its inner inputs' events.** A native `change` from
  the inner `<input>` would otherwise reach a listener above the host looking
  like the element's own but carrying no `detail`. Only `input` is bound —
  binding `change` too would emit twice per commit.
- **happy-dom has no `ElementInternals`**, so form association cannot be tested
  there. That path is verified in a real browser instead.

## Conventions

- **British spelling in identifiers and prose** — `colour`, `colourName`,
  `ColourPicker`. The CSS custom properties are the exception: `--okp-*`.
- Comments explain *why*, not *what*. Match the surrounding density.
- Conventional commits, sentence case: `feat: Add layouts and a parts prop`.
- Do not add Claude/AI attribution or co-author trailers to commits.

## Releasing

Changesets, with all six packages in one `fixed` group so they share a version
number — a core fix cannot leave an adapter behind.

```sh
npm run changeset          # describe the change
npm run version-packages   # apply bumps
npm run release            # build, then publish
```
