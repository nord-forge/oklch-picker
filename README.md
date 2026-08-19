<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="72" height="72">
</picture>

# oklch-picker

An OKLCH colour picker for React, Preact, Vue, Svelte, Solid — and for no framework at all. Zero runtime dependencies; the component is ~4.8 kB gzipped, and the colour maths alone is ~2.5 kB.

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

Install the package for your framework — each pulls in only its own adapter plus the shared core.

| Using | Install | Binding |
| --- | --- | --- |
| **No framework** — plain HTML, HTMX, Alpine, Astro, Rails, Laravel, Django, PHP, WordPress | `oklch-picker` | `<oklch-picker>` element |
| React / Preact | `@oklch-picker/react` | `value` + `onChange` |
| Vue | `@oklch-picker/vue` | `v-model` |
| Svelte 5 | `@oklch-picker/svelte` | `bind:value` |
| Solid | `@oklch-picker/solid` | `value` + `onChange` |

```sh
npm install @oklch-picker/react   # or /vue, /svelte, /solid
npm install oklch-picker          # the no-framework custom element
```

The stylesheet lives in the shared core, which every adapter already depends on:

```js
import "@oklch-picker/core/styles.css";
```

Your framework is an optional peer dependency; Preact works through `preact/compat`, which most Preact setups already alias.

<details>
<summary><strong>Coming from <code>oklch-picker</code> 0.2 or earlier?</strong></summary>

`oklch-picker` used to be the React component; it is now the no-framework custom element, so that `npm i oklch-picker` gives the build that works anywhere. Framework users move to a scoped package:

| Was | Now |
| --- | --- |
| `oklch-picker` | `@oklch-picker/react` |
| `oklch-picker/vue` | `@oklch-picker/vue` |
| `oklch-picker/svelte` | `@oklch-picker/svelte` |
| `oklch-picker/solid` | `@oklch-picker/solid` |
| `oklch-picker/vanilla` | `oklch-picker` |
| `oklch-picker/colour` | `@oklch-picker/core` |
| `oklch-picker/styles.css` | `@oklch-picker/core/styles.css` |

Nothing else changes — the components, props, and emitted values are identical. The split exists so an app downloads only the adapter it uses instead of all five.

</details>

### The shared core

`@oklch-picker/core` holds the colour maths and the headless model, with no UI. Every adapter depends on it, and it is worth installing on its own if you want the maths without a picker — validating stored colours on a server, generating palettes, or naming colours in a table:

```js
import { colourName, clampToGamut, maxChroma } from "@oklch-picker/core";
```

Whichever you import, the props are the same — `presets`, `layout`, `parts`, `labels`, `classPrefix` — and the value semantics follow each framework's idiom. A runnable app per framework lives in [`examples/`](./examples).

## Usage

### React / Preact

```tsx
import { useState } from "react";
import { ColourPicker } from "@oklch-picker/react";
import "@oklch-picker/core/styles.css";

export function Example() {
  const [colour, setColour] = useState("oklch(0.7 0.15 255)");
  return <ColourPicker value={colour} onChange={setColour} />;
}
```

### Vue

```vue
<script setup>
import { ref } from "vue";
import { ColourPicker } from "@oklch-picker/vue";
import "@oklch-picker/core/styles.css";

const colour = ref("oklch(0.7 0.15 255)");
</script>

<template>
  <ColourPicker v-model="colour" />
</template>
```

### Svelte

```svelte
<script>
  import { ColourPicker } from "@oklch-picker/svelte";
  import "@oklch-picker/core/styles.css";

  let colour = $state("oklch(0.7 0.15 255)");
</script>

<ColourPicker bind:value={colour} />
```

### Solid

```tsx
import { createSignal } from "solid-js";
import { ColourPicker } from "@oklch-picker/solid";
import "@oklch-picker/core/styles.css";

export function Example() {
  const [colour, setColour] = createSignal("oklch(0.7 0.15 255)");
  return <ColourPicker value={colour()} onChange={setColour} />;
}
```

### No framework

`oklch-picker` is a custom element, so it is just a tag. That covers **plain HTML, HTMX, Alpine, Astro, and any server-rendered page** — Rails, Laravel, Django, PHP, WordPress. No framework, no bundler, and no build step:

```html
<link rel="stylesheet" href="https://esm.sh/@oklch-picker/core/styles.min.css" />

<oklch-picker id="picker" value="oklch(0.7 0.15 255)"></oklch-picker>

<script type="module">
  import "https://esm.sh/oklch-picker/register";

  document.getElementById("picker").addEventListener("change", (event) => {
    console.log(event.detail.colour); // "oklch(0.7 0.15 120)"
  });
</script>
```

`styles.min.css` is the same stylesheet at 1.3 kB gzipped instead of 2.3 kB — worth using whenever nothing in front of it will minify. With a bundler, import plain `styles.css`: your build minifies it anyway, and the readable file is where the `--okp-*` variables are documented.

With a bundler, the import is `import "oklch-picker/register"` instead. Either way that one side-effect import defines the tag — that is the whole client-side cost, and nothing else needs wiring.

**It works in forms.** The element is form-associated, so it submits under its `name` like a built-in input — no hidden field, and no JavaScript to sync one. A server can render the current value and read the new one straight back from the POST body:

```html
<form method="post">
  <oklch-picker name="brand" value="<%= @brand_colour %>"></oklch-picker>
  <button>Save</button>
</form>
```

Resetting the form restores the value the server rendered, again like a built-in input.

In Astro this needs no `client:*` directive, because there is no framework to hydrate — the page ships the markup and the element upgrades itself:

```astro
---
import "@oklch-picker/core/styles.css";
---

<oklch-picker value="oklch(0.7 0.15 255)"></oklch-picker>

<script>
  import "oklch-picker/register";
</script>
```

**Configuring it.** `value`, `layout`, and `class-prefix` are plain attributes. `parts`, `labels`, and `presets` accept JSON attributes too, so no scripting is needed to configure them:

```html
<oklch-picker
  layout="compact"
  presets='["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]'
  parts='{"charts": false}'
  labels='{"l": "Helderheid"}'
></oklch-picker>
```

`presets` also takes a plain comma-separated list. From script, all of them are settable as properties (`picker.presets = [...]`), and `picker.value` reads and writes the current colour.

The element renders into the light DOM, so the stylesheet and `--okp-*` overrides apply exactly as they do elsewhere — which also means it is not style-isolated.

---

Whatever you use, the emitted value is always a canonical, gamut-clamped `oklch(L C H)` string, and the value you pass in accepts either that or hex.

### Presets

```tsx
<ColourPicker
  value={colour}
  onChange={setColour}
  presets={["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]}
/>
```

### Layouts

- **`chart`** (default) — one large lightness × chroma plot above all three sliders, reshaping as the hue slider moves. Drag it to set lightness and chroma at once.
- **`side-by-side`** — the same large plot and sliders, with preview, hex, name, and presets in a right rail. For wide settings panels.
- **`compact`** — no charts, tighter spacing, single-letter labels inline with each slider. For popovers and toolbars. (Screen readers still get the full labels.)
- **`stacked`** — a thin gamut chart above each axis instead of one large one. Each sweeps the two axes it does not control, so all three show a different slice. This is what 1.0 rendered by default.

> [!NOTE]
> The default changed in 1.1: it was `stacked`. Pass `layout="stacked"` to keep
> the previous arrangement.

```tsx
<ColourPicker value={colour} onChange={setColour} layout="compact" />
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/compact-dark.png">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/compact-light.png" alt="The compact layout: three thin sliders with single-letter labels" width="288">
</picture>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/side-by-side-dark.png">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/side-by-side-light.png" alt="The side-by-side layout: sliders on the left, preview and presets in a right rail" width="468">
</picture>

### Dragging the chart

In the `chart` layout the plot is a control, not a picture: dragging it sets
lightness and chroma at once, using pointer events so it works under touch as
well as a mouse.

The thin per-axis charts in the other layouts are read-only. They are 34px tall,
so a drag would have almost no vertical travel, and it would set two axes at
once directly above the slider that sets one precisely.

Charts are hidden from assistive tech either way — the sliders are the
accessible route, and they reach everything a chart can.

### Hiding parts

Everything except the sliders is optional:

```tsx
<ColourPicker
  value={colour}
  onChange={setColour}
  parts={{ charts: false, name: false, notice: false }}
/>
```

`preview`, `hexInput`, and `name` make up the footer; turning all three off removes it entirely. `notice` is the out-of-gamut message. Presets are controlled by the `presets` prop itself.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `string \| null` | — | `oklch(L C H)` or hex |
| `onChange` | `(colour: string) => void` | — | Receives a canonical, clamped `oklch(L C H)` |
| `presets` | `string[]` | — | Swatches shown above the sliders |
| `layout` | `"stacked" \| "compact" \| "side-by-side" \| "chart"` | `"stacked"` | See [Layouts](#layouts) |
| `parts` | `{ charts?, preview?, hexInput?, name?, notice?: boolean }` | all `true` | Turn parts off, e.g. `{ charts: false }` |
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
  --okp-thumb: #fff;
  --okp-thumb-line: rgb(0 0 0 / 0.55);
  --okp-gap: 10px;
  --okp-radius: 6px;
  --okp-track-height: 12px;
  --okp-chart-height: 34px;
  --okp-chart-large-height: 180px;
  --okp-thumb-size: 16px;
}
```

The `--okp-text` … `--okp-focus` colours are `light-dark()` pairs by default, so override them with a plain colour to pin one, or your own `light-dark()` pair to keep both schemes.

It follows the system colour scheme by default. Set `data-theme="light"` or `data-theme="dark"` on the root element to pin one.

## Colour utilities

The maths is framework-free and exported separately — useful for validating stored colours on a server, generating palettes, or naming colours in a table:

```ts
import { colourName, maxChroma, clampToGamut, toOklch } from "@oklch-picker/core";

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

## Changelog

Release notes live in the [changelog](CHANGELOG.md).

## License

MIT
