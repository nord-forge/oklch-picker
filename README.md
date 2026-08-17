<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="72" height="72">
</picture>

# oklch-picker

An OKLCH colour picker for React and Preact. Zero runtime dependencies; the component is ~4.8 kB gzipped, and the colour maths alone is ~2.5 kB.

Every axis is a slider over a **gamut cross-section** — the filled silhouette is the range sRGB can actually show, so the reachable colours are visible instead of something you discover by dragging into a region that does nothing.

![The picker in dark mode, showing blue and amber](https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/dark.png)

## Why

Most pickers work in HSV and convert. If your design tokens are already OKLCH, that round-trip is lossy and the controls do not map onto what you store.

This one works in OKLCH directly, and takes the gamut seriously:

- **The chroma slider is bounded by what is reachable.** The sRGB gamut is a lopsided solid in OKLCH — peak chroma depends on both lightness and hue. A fixed `0..0.37` slider is up to **87% dead travel** at low lightness: the thumb moves and the colour does not change. Here the maximum is recomputed as the other axes move, so 95–100% of the track does something.
- **Out-of-gamut regions are hatched**, on every axis. Lightness is unreachable at *both* ends at high chroma, and hue can be unreachable in the middle, so a single boundary marker will not do.
- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing chroma, keeping lightness and hue.

At chroma 0.22 most hues cannot sustain that saturation, and the picker says so:

![The picker in light mode at high chroma, with most of the hue axis hatched](https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/light.png)

## Install

```sh
npm install oklch-picker
```

React is a peer dependency; Preact works through `preact/compat`, which most Preact setups already alias. Both are optional — install whichever you use.

## Usage

```tsx
import { useState } from "react";
import { ColourPicker } from "oklch-picker";
import "oklch-picker/styles.css";

export function Example() {
  const [colour, setColour] = useState("oklch(0.7 0.15 255)");
  return <ColourPicker value={colour} onChange={setColour} />;
}
```

`onChange` always receives a canonical, gamut-clamped `oklch(L C H)` string. `value` accepts either that or hex.

### Presets

```tsx
<ColourPicker
  value={colour}
  onChange={setColour}
  presets={["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]}
/>
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `string \| null` | — | `oklch(L C H)` or hex |
| `onChange` | `(colour: string) => void` | — | Receives a canonical, clamped `oklch(L C H)` |
| `presets` | `string[]` | — | Swatches shown above the sliders |
| `charts` | `boolean` | `true` | Show the gamut cross-sections |
| `hexInput` | `boolean` | `true` | Show the hex field |
| `readout` | `boolean` | `true` | Show the colour's name |
| `labels` | `Partial<Record<"l"\|"c"\|"h"\|"outOfGamut", string>>` | English | For translation |
| `classPrefix` | `string` | `"oklch-picker"` | Prefix for every class name |
| `className` | `string` | — | Added to the root element |

## Styling

`oklch-picker/styles.css` is a starting point, not a requirement — every element has a stable class name, so you can skip it entirely and write your own.

If you do use it, the palette is custom properties on the root:

```css
.oklch-picker {
  --okp-text: #1a1a1a;
  --okp-text-muted: #6b6b6b;
  --okp-line: #d8d8d8;
  --okp-surface: #ffffff;
  --okp-warn: #9a6b00;
  --okp-focus: #2f6fd0;
  --okp-radius: 6px;
  --okp-track-height: 12px;
  --okp-chart-height: 34px;
  --okp-thumb-size: 16px;
}
```

It follows the system colour scheme by default. Set `data-theme="light"` or `data-theme="dark"` on the root element to pin one.

## Colour utilities

The maths is framework-free and exported separately — useful for validating stored colours on a server, generating palettes, or naming colours in a table:

```ts
import { colourName, maxChroma, clampToGamut, toOklch } from "oklch-picker/colour";

colourName("oklch(0.43 0.19 338)");  // "Dark pink"
maxChroma(0.7, 255);                 // 0.160 — highest chroma sRGB can show there
clampToGamut({ l: 0.75, c: 0.35, h: 145 });  // chroma reduced until it fits
```

| | |
|---|---|
| `toOklch`, `parseOklch`, `formatOklch` | Parse and format |
| `hexToOklch`, `oklchToHex` | Convert, exact round-trip within sRGB |
| `inGamut`, `clampToGamut`, `maxChroma` | Gamut queries |
| `gamutCurve` | Cross-section data behind the charts |
| `colourName` | "Dark pink", "Muted teal", "Light grey" |
| `isLight` | WCAG luminance, for readable text over a swatch |

## Accessibility

Built on native `<input type="range">`, so keyboard, touch, and screen-reader support come from the platform. Each slider carries its own label, and the visible label is `aria-hidden` so controls are not announced twice.

## Browser support

Needs `oklch()` in CSS for preset swatches — Chrome/Edge 111+, Safari 15.4+, Firefox 113+. The charts, tracks and previews are computed to hex, so they render anywhere.

## License

MIT
