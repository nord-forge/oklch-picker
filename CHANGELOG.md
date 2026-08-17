# Changelog

## [Unreleased]

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
