<!-- The mark lives inside the heading so the two sit on one line. GitHub strips
     most inline styles from README markup, and a <picture> as a sibling of the
     <h1> becomes its own block, which pushed the title onto the next row. -->
<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
    <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="34" height="34" align="absmiddle">
  </picture>
  oklch-picker
</h1>

An OKLCH colour picker for React, Preact, Vue, Svelte, Solid, Angular, Qwik, and for no framework at all. Zero runtime dependencies. The component is ~6.5 kB gzipped, and the colour maths alone is ~2.5 kB.

**[Documentation and live demos](https://nord-forge.github.io/oklch-picker/)**, covering every layout and every part, with a playground that emits code you can copy.

Every axis is a slider over a **gamut cross-section**. The filled silhouette is the range sRGB can actually show, so the reachable colours are visible instead of something you discover by dragging into a region that does nothing.

**[See it running](https://nord-forge.github.io/oklch-picker/)**, in light or dark, with every layout and part on a page of its own. There is no screenshot here on purpose: a still image of a picker that keeps moving goes stale, and the last set did.

## Why

Most pickers work in HSV and convert. If your design tokens are already OKLCH, that round-trip is lossy and the controls do not map onto what you store.

This one works in OKLCH directly, and takes the gamut seriously:

- **The chroma slider is bounded by what is reachable.** The sRGB gamut is a lopsided solid in OKLCH, so peak chroma depends on both lightness and hue. A fixed `0..0.37` slider is up to **87% dead travel** at low lightness. The thumb moves and the colour does not change. Here the maximum is recomputed as the other axes move, so 95 to 100% of the track does something.
- **Out-of-gamut regions are hatched**, on every axis. Lightness is unreachable at *both* ends at high chroma, and hue can be unreachable in the middle, so a single boundary marker will not do.
- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing chroma, keeping lightness and hue.

At chroma 0.22 most hues cannot sustain that saturation, and the picker says so. **[Try it](https://nord-forge.github.io/oklch-picker/)**: push chroma up and watch the hue track hatch out.

## Install

Install the package for your framework. Each pulls in only its own adapter plus the shared core.

| Using | Install | Binding |
| --- | --- | --- |
| **No framework** (plain HTML, HTMX, Alpine, Astro, Rails, Laravel, Django, PHP, WordPress) | `oklch-picker` | `<oklch-picker>` element |
| React / Preact | `@oklch-picker/react` | `value` + `onChange` |
| Vue | `@oklch-picker/vue` | `v-model` |
| Svelte 5 | `@oklch-picker/svelte` | `bind:value` |
| Solid | `@oklch-picker/solid` | `value` + `onChange` |
| Angular 17+ | `@oklch-picker/angular` | `[value]` + `(valueChange)` |
| Qwik | `@oklch-picker/qwik` | `value` + `onChange$` |

```sh
npm install @oklch-picker/react   # or /vue, /svelte, /solid, /angular, /qwik
npm install oklch-picker          # the no-framework custom element
```

The stylesheet lives in the shared core, which every adapter already depends on:

```js
import "@oklch-picker/core/styles.css";
```

Your framework is an optional peer dependency; Preact works through `preact/compat`, which most Preact setups already alias.

<details>
<summary><strong>Upgrading from 1.0? Four things moved.</strong></summary>

1.1 is a minor release, but it changes what an existing picker draws. Every previous arrangement is still reachable by passing a prop.

| What changed | To keep 1.0's behaviour |
| --- | --- |
| The hex field is off, an editable `oklch()` field takes its place | `parts={{ hexInput: true }}` |
| The default layout is `chart`, not `stacked` | `layout="stacked"` |
| Presets sit below the chart rather than above it | Not configurable; see [Layouts](#layouts) for the arrangements |
| An alpha slider is on by default | `parts={{ alpha: false }}` |

Hex went off by default because it is sRGB only, so it cannot carry a P3 or Rec. 2020 colour at all, which makes it a poor lead for a picker whose point is the gamut. It is one prop away.

**Nothing you have stored changes.** An opaque colour still emits `oklch(0.7 0.15 255)` exactly as it did, hex stays six digits, and the alpha forms appear only when a colour is actually transparent.

</details>

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

Nothing else changes. The components, props, and emitted values are identical. The split exists so an app downloads only the adapter it uses instead of every one of them.

</details>

### The shared core

`@oklch-picker/core` holds the colour maths and the headless model, with no UI. Every adapter depends on it. It is worth installing on its own if you want the maths without a picker, say for validating stored colours on a server, generating palettes, or naming colours in a table:

```js
import { colourName, clampToGamut, maxChroma } from "@oklch-picker/core";
```

Whichever you import, the props are the same: `presets`, `layout`, `parts`, `labels`, `classPrefix`. The value semantics follow each framework's idiom. A runnable app per framework lives in [`examples/`](./examples).

## Usage

**The adapters are controlled.** A picker keeps no colour of its own: it renders
whatever `value` you pass, so the value it hands back has to come back in.
`v-model` and `bind:value` do that for you. React, Solid, Angular and Qwik want
the pair wired explicitly, and wiring only the callback leaves the sliders stuck
while the picker emits against a colour that never changes.

The `<oklch-picker>` element is the exception. It holds its own colour and
updates its own `value` attribute, so it works with no listener at all.

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

`oklch-picker` is a custom element, so it is just a tag. That covers **plain HTML, HTMX, Alpine, Astro, and any server-rendered page**, including Rails, Laravel, Django, PHP, and WordPress. No framework, no bundler, and no build step:

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

`styles.min.css` is the same stylesheet at 2.1 kB gzipped instead of 6.1 kB. Use it whenever nothing in front of it will minify. With a bundler, import plain `styles.css`. Your build minifies it anyway, and the readable file is where the `--okp-*` variables are documented.

With a bundler, the import is `import "oklch-picker/register"` instead. Either way that one side-effect import defines the tag. That is the whole client-side cost, and nothing else needs wiring.

**It works in forms.** The element is form-associated, so it submits under its `name` like a built-in input. No hidden field, and no JavaScript to sync one. A server can render the current value and read the new one straight back from the POST body:

```html
<form method="post">
  <oklch-picker name="brand" value="<%= @brand_colour %>"></oklch-picker>
  <button>Save</button>
</form>
```

Resetting the form restores the value the server rendered, again like a built-in input.

In Astro this needs no `client:*` directive, because there is no framework to hydrate. The page ships the markup and the element upgrades itself:

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

The element renders into the light DOM, so the stylesheet and `--okp-*` overrides apply exactly as they do elsewhere. That also means it is not style-isolated.

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

- **`chart`** (default) puts one large lightness × chroma plot above all three sliders, reshaping as the hue slider moves. Drag it to set lightness and chroma at once.
- **`side-by-side`** keeps the same large plot and sliders, with preview, hex, name, and presets in a right rail. For wide settings panels. It caps itself at `--okp-side-by-side-width` (560px) so the chart has room to be worth reading; override that and `--okp-rail-width` to resize it.
- **`compact`** drops the charts, tightens the spacing, and puts single-letter labels inline with each slider. For popovers and toolbars. (Screen readers still get the full labels.)
- **`stacked`** puts a thin gamut chart above each axis instead of one large one. Each sweeps the two axes it does not control, so all three show a different slice. This is what 1.0 rendered by default.

> [!NOTE]
> The default changed in 1.1: it was `stacked`. Pass `layout="stacked"` to keep
> the previous arrangement.

```tsx
<ColourPicker value={colour} onChange={setColour} layout="compact" />
```

**[All four layouts are running on the docs site](https://nord-forge.github.io/oklch-picker/docs/layouts/)**, side by side and draggable, in whichever colour scheme you prefer.

### Dragging the chart

In the `chart` layout the plot is a control, not a picture: dragging it sets
lightness and chroma at once, using pointer events so it works under touch as
well as a mouse.

The thin per-axis charts in the other layouts are read-only. They are 34px tall,
so a drag would have almost no vertical travel, and it would set two axes at
once directly above the slider that sets one precisely.

Charts are hidden from assistive tech either way. The sliders are the
accessible route, and they reach everything a chart can.

### Wider gamuts

The picker works in sRGB by default and ships nothing else. Pass `gamut` to
work in a wider space instead:

```tsx
import { P3 } from "@oklch-picker/core/gamuts";

<ColourPicker value={colour} onChange={setColour} gamut={P3} />
```

That is the **output** space, not decoration: the chroma slider reaches
further, the value is clamped to P3 rather than sRGB, and the notice only fires
once a colour leaves P3 too. Choosing P3 and then still emitting an sRGB colour
would defeat the point of choosing it.

sRGB is outlined on the chart as a reference whenever it is not the output, so
the safe region stays visible. Override with `references` to draw others, or
`references={[]}` for none.

`P3` and `REC2020` live behind their own entry point on purpose. An app that
never imports them never ships the matrices. The bundler drops the module
statically, so there is no dynamic import and nothing async in the render path.

**Only `oklch()` carries a wide-gamut colour.** `rgb()`, `hsl()`, `hwb()` and
hex all describe an sRGB colour, so a P3 or Rec. 2020 value written in any of
them is the nearest sRGB colour instead. Nothing warns you: the string is
valid, displayable, and a different colour. That is why the hex and `rgb()`
fields are off by default, and why `value` stores `oklch()`. Convert at the
edges, where a legacy format is actually required.

```js
import { formatOklch, formatHsl, oklchToHex, inGamut, SRGB } from "@oklch-picker/core";

const green = { l: 0.86, c: 0.28, h: 145 };  // P3 reaches this, sRGB does not

formatOklch(green);  // "oklch(0.86 0.28 145)"       the colour, intact
oklchToHex(green);   // "#01fb48"                    nearest sRGB
formatHsl(green);    // "hsl(137.04 99.21% 49.41%)"  nearest sRGB

// Ask first, if a silent shift would matter.
if (!inGamut(green, SRGB)) keepAsOklch(green);
```

None of the sRGB formatters takes a `gamut`, deliberately. A browser reads
their numbers as sRGB, so passing a wider space would write channels that
render as some other colour entirely.
Opting in costs a few hundred bytes.

### Letting the user switch

Off by default. Turn it on and the picker renders a small segmented control:

```tsx
const [gamut, setGamut] = useState(SRGB);

<ColourPicker
  value={colour}
  onChange={setColour}
  gamut={gamut}
  onGamutChange={setGamut}
  gamutChoices={[SRGB, P3, REC2020]}
  parts={{ gamutSwitch: true }}
/>
```

`gamutChoices` defaults to the output gamut plus its references. The control
hides itself when that leaves only one option. One option is not a choice.

### Recently used colours

On by default, and empty until something is committed, so it costs nothing
until it has something to show:

```tsx
<ColourPicker value={colour} onChange={setColour} />
```

That keeps a list for the session, per picker. To store them yourself, in a
backend or shared between pickers, pass the list in and take the updates:

```tsx
const [recents, setRecents] = useState(loadFromServer);

<ColourPicker
  value={colour}
  onChange={setColour}
  recents={recents}
  onRecentsChange={(next) => {
    setRecents(next);
    save(next);
  }}
/>
```

A colour joins the list when it is **committed**, meaning a pointer release, a
preset click, a hex entry, or leaving a slider. Not on every value a drag passes
through. Dragging the hue slider across the spectrum records one colour, not
forty. Repeats move to the front rather than appearing twice, and the list is
capped at `maxRecents` (8 by default).

`parts={{ recents: false }}` removes the row.

### Notices

When a colour falls outside the output gamut the picker says so. The wording
comes from `labels`, and there are two keys:

- **`outOfGamut`** is the sRGB message, and the fallback for any space with no
  wording of its own. Defaults to *"Outside sRGB, the nearest sRGB colour is
  used."*
- **`outOf:<gamut id>`** is the message for one output space. With `gamut={P3}`
  the default becomes *"Outside Display P3, the nearest Display P3 colour is
  used."*

Every message names its own space rather than saying "outside what a screen can
display": P3 is a screen too, so that phrasing was only ever true while sRGB
was the only option.

Override either:

```tsx
<ColourPicker
  labels={{
    outOfGamut: "Not displayable.",
    "outOf:p3": "Needs a wide-gamut screen.",
  }}
/>
```

Or turn the message off entirely, leaving the maths untouched. The value is
still clamped and the hatching still shows. Only the text goes:

```tsx
<ColourPicker parts={{ notice: false }} />
```

### Hiding parts

Everything except the sliders is optional:

```tsx
<ColourPicker
  value={colour}
  onChange={setColour}
  parts={{ charts: false, name: false, notice: false }}
/>
```

| Part | Default | Covers |
| --- | --- | --- |
| `charts` | on | The gamut plots, large or thin |
| `preview` | on | The swatch in the footer |
| `oklchInput` | on | The editable `oklch()` field |
| `rgbInput` | **off** | The editable `rgb()` field |
| `hexInput` | **off** | The editable hex field |
| `alpha` | on | The alpha slider |
| `gamutLines` | on | Dashed outlines of narrower spaces on the chart, with their labels |
| `name` | on | The colour name in the footer |
| `notice` | on | The out-of-gamut message |
| `recents` | on | The recent colours row |
| `gamutSwitch` | **off** | The output space switcher |

`preview`, the three value fields, and `name` make up the footer. Turning all of them off removes it entirely. Presets are controlled by the `presets` prop itself.

### The value fields

The picker shows an editable `oklch()` field by default. Turn on as many of the three as you want:

```tsx
<ColourPicker value={colour} onChange={setColour} parts={{ rgbInput: true, hexInput: true }} />
```

Each field accepts **any** supported format, whichever one it displays. Pasting a hex into the `oklch()` field works, so there is no rule to learn about which box takes what.

> [!NOTE]
> The hex field was on by default in 1.0 and is off from 1.1. Hex is sRGB only,
> so it cannot carry a P3 or Rec. 2020 colour at all, which makes it a poor
> default for a picker whose point is the gamut. Pass
> `parts={{ hexInput: true }}` to keep it.

### Alpha

OKLCH carries alpha, so the picker has a fourth slider for it, on by default. Without it a value passed in with transparency would come back opaque.

```tsx
<ColourPicker value="oklch(0.7 0.15 255 / 0.4)" onChange={setColour} />
```

An opaque colour is unchanged in every format: `oklch(0.7 0.15 255)` stays exactly that, hex stays six digits, and `rgb()` stays three channels. The alpha forms appear only when a colour is actually transparent, and dragging back to fully opaque drops the alpha rather than emitting `/ 1`.

`parts={{ alpha: false }}` removes the slider.

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` | `string \| null` | none | `oklch()`, `rgb()`, `hsl()`, `hwb()` or hex, with or without alpha |
| `onChange` | `(colour: string) => void` | none | Receives a canonical, clamped `oklch(L C H)`, or `oklch(L C H / A)` when transparent |
| `presets` | `string[]` | none | Swatches shown below the sliders |
| `recents` | `string[]` | none | Controlled recent colours; omit to keep a session list |
| `onRecentsChange` | `(recents: string[]) => void` | none | Fired on commit, not during a drag |
| `maxRecents` | `number` | `8` | How many recents to keep, when `recents` is not passed |
| `layout` | `"chart" \| "side-by-side" \| "compact" \| "stacked"` | `"chart"` | See [Layouts](#layouts) |
| `parts` | `{ charts?, preview?, oklchInput?, rgbInput?, hexInput?, alpha?, gamutLines?, name?, notice?, recents?, gamutSwitch?: boolean }` | on except `rgbInput`, `hexInput`, `gamutSwitch` | Turn parts off, e.g. `{ charts: false }` |
| `labels` | `Partial<Record<LabelKey, string>>` | English | Translation and custom notices. See [Notices](#notices) |
| `gamut` | `Gamut` | `SRGB` | The output space, clamped and emitted. See [Wider gamuts](#wider-gamuts) |
| `references` | `Gamut[]` | `[SRGB]` when wider | Spaces outlined on the chart but never clamped to |
| `gamutChoices` | `Gamut[]` | output + references | What the switcher offers |
| `onGamutChange` | `(gamut: Gamut) => void` | none | Fired by the built-in switcher |
| `classPrefix` | `string` | `"oklch-picker"` | Prefix for every class name. Changing it opts out of `styles.css`, which targets the default |
| `className` | `string` | none | Added to the root element |

## Styling

`oklch-picker/styles.css` is a starting point, not a requirement. Every element has a stable class name, so you can skip it entirely and write your own.

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
  --okp-side-by-side-width: 560px;
  --okp-rail-width: 152px;
  --okp-thumb-size: 16px;
}
```

The `--okp-text` … `--okp-focus` colours are `light-dark()` pairs by default, so override them with a plain colour to pin one, or your own `light-dark()` pair to keep both schemes.

It follows the system colour scheme by default. Set `data-theme="light"` or `data-theme="dark"` on the root element to pin one.

## Colour utilities

The maths is framework-free and exported separately. That is useful for validating stored colours on a server, generating palettes, or naming colours in a table:

```ts
import { colourName, maxChroma, clampToGamut, toOklch } from "@oklch-picker/core";

colourName("oklch(0.43 0.19 338)");  // "Dark pink"
maxChroma(0.7, 255);                 // 0.160, the highest chroma sRGB shows there
clampToGamut({ l: 0.75, c: 0.35, h: 145 });  // chroma reduced until it fits
```

| | |
|---|---|
| `toOklch`, `parseOklch`, `formatOklch` | Parse and format. `toOklch` takes any supported form |
| `hexToOklch`, `oklchToHex` | Convert, exact round-trip within sRGB |
| `parseRgb`, `formatRgb`, `oklchToRgb255` | The same for `rgb()` and `rgba()` |
| `parseHsl`, `formatHsl` | The same for `hsl()` and `hsla()` |
| `parseHwb`, `formatHwb` | The same for `hwb()` |
| `hasAlpha`, `alphaOf` | Ask about transparency without re-deriving "absent means opaque" |
| `inGamut`, `clampToGamut`, `maxChroma` | Gamut queries |
| `gamutCurve` | Cross-section data behind the charts |
| `colourName` | "Dark pink", "Muted teal", "Light grey" |
| `isLight` | WCAG luminance, for readable text over a swatch |

Alpha rides along rather than being a fourth axis. It cannot move a colour in or out of gamut, so `inGamut` ignores it and `clampToGamut` preserves it:

```ts
import { alphaOf, clampToGamut, formatOklch } from "@oklch-picker/core";

const dialled = { l: 0.75, c: 0.35, h: 145, a: 0.4 };
const fitted = clampToGamut(dialled);   // chroma reduced, alpha untouched
alphaOf(fitted);                        // 0.4
formatOklch(fitted);                    // "oklch(0.75 0.2359 145 / 0.4)"
```

## Lit, Alpine and HTMX

None of these needs an adapter. `<oklch-picker>` is a custom element, so it already works in all three, and a wrapper package would add a version to keep in lockstep in exchange for syntax you can write today.

Lit binds properties with a leading dot, which is what the object props want:

```js
html`<oklch-picker .value=${this.colour} .gamut=${P3} @change=${(e) => (this.colour = e.detail.colour)}></oklch-picker>`
```

Alpine needs `x-effect` rather than `x-model`. `x-model` recognises built-in form controls, so on a custom element it sets the initial value and then never updates:

```html
<oklch-picker x-effect="$el.value = colour" @change="colour = $event.detail.colour"></oklch-picker>
```

HTMX needs nothing at all. The element is form-associated, so a `name` is enough for it to submit like any other field.

**[The full recipes](https://nord-forge.github.io/oklch-picker/docs/recipes/)** cover the stylesheet in a shadow root, binding objects in Alpine, and coalescing HTMX requests.

## Server rendering

Every adapter renders on a server, and the markup it sends is the finished picker rather than an empty shell that fills in on the client. There is no server entry point and nothing to configure: the colour maths touches no DOM, so it runs the same in both places.

```tsx
import { renderToString } from "react-dom/server";
renderToString(<ColourPicker value={colour} onChange={setColour} />);
```

The custom element is the exception. It upgrades in the browser rather than being rendered to HTML, so server-render the tag and import `oklch-picker/register` from a client-only block. Importing it on a server is safe and does nothing, but the element cannot upgrade there.

Rails, Laravel, Django, PHP and WordPress serve the tag as text and never import the module, so none of that applies to them.

**[The full guide](https://nord-forge.github.io/oklch-picker/docs/ssr/)** covers Astro, Next and Nuxt, and what hydration depends on.

## Accessibility

Built on native `<input type="range">`, so keyboard, touch, and screen-reader support come from the platform. Each slider carries its own label, and the visible label is `aria-hidden` so controls are not announced twice.

## Browser support

Needs `oklch()` in CSS for preset swatches, so Chrome/Edge 111+, Safari 15.4+, Firefox 113+. The charts, tracks and previews are computed to hex, so they render anywhere.

## Changelog

Release notes live in the [changelog](CHANGELOG.md).

## License

MIT
