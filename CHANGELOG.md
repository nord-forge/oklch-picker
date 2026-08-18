# Changelog

## [Unreleased]

### Breaking

- **The unscoped `oklch-picker` package is deprecated.** The library is now
  published as scoped packages, one per framework: `@oklch-picker/react`,
  `/vue`, `/svelte`, `/solid`, `/vanilla`, and `@oklch-picker/core` for the
  shared maths, model, and stylesheet.

  | Was | Now |
  | --- | --- |
  | `oklch-picker` | `@oklch-picker/react` |
  | `oklch-picker/vue` | `@oklch-picker/vue` |
  | `oklch-picker/svelte` | `@oklch-picker/svelte` |
  | `oklch-picker/solid` | `@oklch-picker/solid` |
  | `oklch-picker/colour` | `@oklch-picker/core` |
  | `oklch-picker/styles.css` | `@oklch-picker/core/styles.css` |

  The components, props, and emitted values are unchanged. Installing one
  adapter no longer downloads the other four — a React app pulls ~13 kB packed
  instead of ~32 kB.

- Every scoped package moves together on one version number, so a core fix
  cannot leave an adapter behind.

### Added

- Framework adapters, each on the same headless model and the same stylesheet,
  published as subpath exports: `oklch-picker/vue` (`v-model`),
  `oklch-picker/svelte` (`bind:value`, Svelte 5 runes), and
  `oklch-picker/solid`. `oklch-picker/react` is a new alias of the root export,
  which is unchanged.
- `oklch-picker/styles.min.css` — the same stylesheet minified, 1.3 kB gzipped
  against 2.3 kB. For the no-build path, where nothing else will compress it;
  bundler users should keep importing `styles.css`.
- `oklch-picker/vanilla` — the picker as a `<oklch-picker>` custom element, with
  no framework and no build step. Covers plain HTML, HTMX, Alpine, Astro, and
  any server-rendered page. It is form-associated, so it submits with a
  surrounding form under its `name` and restores on reset, and its `change`
  event is typed for `event.detail.colour`.
- Every framework is an optional peer dependency, so a consumer's bundler only
  resolves the subpath it imports.
- A runnable example app per framework under `examples/`, plus `npm run dev` to
  serve all five at once.

### Changed

- The draft/emit resolution, the gamut-clamped emit, and the chart memo key move
  from the React component into the shared model, so every adapter derives them
  identically rather than reimplementing them. No API change.

## [0.2.0] — 2026-08-17

### Breaking

- The `charts`, `hexInput`, and `readout` props are replaced by a single `parts` prop.
  Migrate `charts={false}` to `parts={{ charts: false }}`; the old `readout` is now
  `parts={{ name: false }}`. `parts` also covers the preview swatch and the
  out-of-gamut notice — everything except the sliders can be turned off.
- The default stylesheet now uses `light-dark()` for its palette, raising the CSS
  support floor to Baseline mid-2024 browsers (Chrome/Edge 123+, Safari 17.5+,
  Firefox 120+). Overriding the `--okp-*` colour variables works as before.
- Default track height is now 12px (was 10px) and thumb size 16px (was 13px),
  matching the documented values. Set `--okp-track-height` / `--okp-thumb-size`
  to restore the old look.

### Added

- `layout` prop with three arrangements: `stacked` (default), `compact` (no
  charts, single-letter labels inline with each slider), and `side-by-side`
  (readout and presets in a right rail).
- Slider thumb theming via `--okp-thumb` and `--okp-thumb-line`.
- `Axis`, `PickerLayout`, and `PickerParts` are exported types.

### Changed

- Gamut charts are memoised on the one axis value each curve depends on;
  dragging the chroma slider no longer recomputes any chart.
- Internals split into framework-free colour maths, a headless picker model,
  and thin components, in preparation for adapters beyond React and Preact.

## [0.1.0] — 2026-08-17

Initial release.

[Unreleased]: https://github.com/nord-forge/oklch-picker/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/nord-forge/oklch-picker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nord-forge/oklch-picker/releases/tag/v0.1.0
