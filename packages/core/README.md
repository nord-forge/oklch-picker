<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="72" height="72">
</picture>

# @oklch-picker/core

The OKLCH colour maths and headless picker model behind every `oklch-picker` adapter. **No UI.** Framework-free, no DOM, zero dependencies.

**[Documentation and live demos](https://nord-forge.github.io/oklch-picker/)**

Every axis is a slider over a **gamut cross-section**. The filled silhouette is the range sRGB can actually show, so the reachable colours are visible. You do not have to discover them by dragging into a region that does nothing.

![The picker in dark mode, showing blue and amber](https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/dark.png)

- **The chroma slider is bounded by what is reachable.** A fixed `0..0.37` slider is up to **87% dead travel** at low lightness. Here the maximum is recomputed as the other axes move.
- **Out-of-gamut regions are hatched**, on every axis.
- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing chroma, keeping lightness and hue.

## Install

```sh
npm install @oklch-picker/core
```

## Usage

Every adapter depends on this package, so you rarely install it directly for a picker. On its own it is useful for colour work with no UI attached: validating stored values on a server, generating palettes, or naming colours in a table.

```js
import { colourName, clampToGamut, maxChroma, toOklch } from "@oklch-picker/core";

colourName("oklch(0.75 0.16 145)");  // "Green"
maxChroma(0.75, 145);                // highest chroma sRGB can show here
clampToGamut({ l: 0.2, c: 0.3, h: 145 });  // reduced to what fits
```

It also holds the shared stylesheet:

```js
import "@oklch-picker/core/styles.css";      // or styles.min.css
```

## The family

| Using | Install |
| --- | --- |
| No framework: HTML, HTMX, Alpine, Astro, Rails, Laravel, Django | [`oklch-picker`](https://www.npmjs.com/package/oklch-picker) |
| React / Preact | [`@oklch-picker/react`](https://www.npmjs.com/package/@oklch-picker/react) |
| Vue | [`@oklch-picker/vue`](https://www.npmjs.com/package/@oklch-picker/vue) |
| Svelte 5 | [`@oklch-picker/svelte`](https://www.npmjs.com/package/@oklch-picker/svelte) |
| Solid | [`@oklch-picker/solid`](https://www.npmjs.com/package/@oklch-picker/solid) |
| The maths and headless model alone | [`@oklch-picker/core`](https://www.npmjs.com/package/@oklch-picker/core) |

Full documentation lives in the [repository README](https://github.com/nord-forge/oklch-picker#readme).

## Licence

MIT © Nick Bevers
