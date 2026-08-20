# oklch-picker

An OKLCH colour picker published as eight packages: one shared core and seven
framework adapters. Zero runtime dependencies.

## Layout

```
packages/
  core/       @oklch-picker/core     colour maths + headless model + stylesheet
  react/      @oklch-picker/react    also serves Preact via preact/compat
  vue/        @oklch-picker/vue
  svelte/     @oklch-picker/svelte   ships uncompiled .svelte source
  solid/      @oklch-picker/solid    ships JSX source
  angular/    @oklch-picker/angular  standalone + signals, built with ngc
  qwik/       @oklch-picker/qwik     resumable; ships JSX source
  vanilla/    oklch-picker           the <oklch-picker> custom element
test/         one suite per adapter, run from the repo root
examples/     one runnable app per adapter
```

`packages/vanilla` publishes under the **bare `oklch-picker` name**, not a
scoped one: someone who types `npm i oklch-picker` without naming a framework
wants the build that works anywhere. Its directory name still says `vanilla`
because that reads better next to its siblings.

## Commands

Node 22.18+ is required to build (tsdown's floor); the published packages run
on Node 20.

```sh
npm run build       # all packages, in dependency order
npm test            # 384 tests across 24 vitest projects
npm run typecheck   # tsc, then Solid, Qwik, Angular's ngc, svelte-check
npm run lint        # biome; lint:fix to write
npm run dev         # every example at once, from port 5272 up
```

Run `npm run build` before the examples. They resolve each package's `dist/`,
not its source, so edits under `packages/*/src` need a rebuild to show up.

Two other places resolve `dist/` rather than source, and both fail silently by
testing the *previous* build rather than erroring:

- **`vanilla`'s tests** import through its published `exports` map, so a change
  under `packages/vanilla/src` needs `npm run build --workspace=oklch-picker`
  before `npm test` reflects it.
- **`typecheck`'s Solid pass** reads `packages/core/dist/*.d.mts`, so a core API
  change needs `npm run build --workspace=@oklch-picker/core` first, or it
  reports errors against the old types.

## Architecture

**Everything derives from `core`.** `colour.ts` is the maths; `model.ts` is the
headless model. It covers axis ranges, track gradients, chart geometry, the
draft/emit resolution, and the chart memo key. `pickerModel()` returns
everything a picker needs for one render.

An adapter therefore contains only markup and state wiring, ~250 lines each.
**When you change behaviour, change `model.ts`** so all seven adapters get it;
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
  only one of the other two axes. See `chartKey`. Keying on that means dragging
  an unrelated slider reuses the path and its ~65 gradient stops.
- **The stylesheet is shared and class-based**, and every adapter honours
  `classPrefix`. It lives in `core`.

## Constraints that are easy to trip over

- **Solid and Svelte ship source, not builds.** Both ecosystems expect the
  consumer's compiler to handle it. For Solid this is not just convention: one
  tsconfig cannot hold two JSX settings, so bundling it here compiles its JSX
  with React's runtime and the output imports `react`. Solid has its own
  `tsconfig.json` and its own `tsc` pass.
- **Angular builds with `ngc`, not tsdown.** tsdown strips the types but leaves
  `@Component` in the output as raw decorator syntax, which is not valid
  JavaScript. Plain `tsc` gets past that and still fails: it does not know about
  signal inputs, so every `input()` is invisible to the template and Angular
  reports `NG0303` at runtime. `ngc` is `tsc` plus Angular's own transforms, and
  it is the only one of the three that produces a working component.
- **Angular's template checker is opt-in.** `strictTemplates` lives in
  `angularCompilerOptions` in `packages/angular/tsconfig.build.json`. Without it
  a typo in a binding compiles to a silent runtime no-op rather than an error,
  so the build passes and the picker quietly loses a control.
- **Angular 21 is the build-time floor, 17 is the consumer floor.** Angular 22's
  compiler wants TypeScript 6 and the repo is on 5.9, which Astro pins. Building
  against 21 keeps one TypeScript across the monorepo while `peerDependencies`
  still says `>=17`.
- **Qwik cannot serialise a `Gamut`.** It carries `fromLms`, and Qwik
  serialises props, computed signals, and whatever a QRL closes over. All three
  bit during the port. The adapter takes gamut *ids* and resolves them inside
  its own module; `pickerModel` is called during render rather than held in a
  `useComputed$`; and handlers resolve gamuts from ids rather than capturing
  them. An object that reaches any of those three paths fails the server render.
- **Building an array inline in Qwik JSX drops every event binding.** A new
  array per render reads as a changed prop, and the re-render that follows
  silently unbinds the whole component: the first interaction works and nothing
  after it does, with no error. Keep such props in a `useComputed$`.
- **`sideEffects` must list the register entry.** `packages/vanilla` declares
  `./dist/register.mjs`; without it, bundlers tree-shake the
  `customElements.define` call away and the element silently never upgrades.
- **The vanilla element stops its inner inputs' events.** A native `change` from
  the inner `<input>` would otherwise reach a listener above the host looking
  like the element's own but carrying no `detail`. Only `input` is bound.
  Binding `change` too would emit twice per commit.
- **happy-dom has no `ElementInternals`**, so form association cannot be tested
  there. That path is verified in a real browser instead.

## Conventions

- **British spelling in identifiers and prose**, so `colour`, `colourName`,
  `ColourPicker`. The CSS custom properties are the exception: `--okp-*`.
- Comments explain *why*, not *what*. Match the surrounding density.
- Conventional commits, sentence case: `feat: Add layouts and a parts prop`.
- Do not add Claude/AI attribution or co-author trailers to commits.

## Releasing

Changesets, with all eight packages in one `fixed` group so they share a version
number. A core fix cannot leave an adapter behind.

```sh
npm run changeset          # describe the change
npm run version-packages   # apply bumps
npm run release            # build, then publish
```
