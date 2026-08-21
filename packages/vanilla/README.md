<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="72" height="72">
</picture>

# oklch-picker

An OKLCH colour picker as a **custom element**. No framework, no build step. For plain HTML, HTMX, Alpine, Astro, and any server-rendered page.

**[Documentation and live demos](https://nord-forge.github.io/oklch-picker/)**

Every axis is a slider over a **gamut cross-section**. The filled silhouette is the range sRGB can actually show, so the reachable colours are visible. You do not have to discover them by dragging into a region that does nothing.

**[See it running](https://nord-forge.github.io/oklch-picker/)**, in light or dark, with every layout and part on a page of its own.

- **The chroma slider is bounded by what is reachable.** A fixed `0..0.37` slider is up to **87% dead travel** at low lightness. Here the maximum is recomputed as the other axes move.
- **Out-of-gamut regions are hatched**, on every axis.
- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing chroma, keeping lightness and hue.

## Install

```sh
npm install oklch-picker
```

## Usage

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

With a bundler, the import is `import "oklch-picker/register"`. Either way, that one side-effect import defines the tag. That is the whole client-side cost.

**It keeps its own colour.** Drag a slider and the element updates itself and its `value` attribute, with no listener required. Set `value` from outside whenever you want to drive it, and listen for `change` when you want to know. This is the one place the element differs from the framework adapters, which render whatever `value` you pass and hold nothing of their own.

**It works in forms.** The element is form-associated, so it submits under its `name` like a built-in input. There is no hidden field to keep in sync.

```html
<form method="post">
  <oklch-picker name="brand" value="<%= @brand_colour %>"></oklch-picker>
  <button>Save</button>
</form>
```

**Configuring it.** `value`, `layout`, and `class-prefix` are plain attributes; `parts`, `labels`, and `presets` also accept JSON attributes, so no scripting is needed:

```html
<oklch-picker
  layout="compact"
  presets='["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]'
  parts='{"charts": false}'
></oklch-picker>
```

It renders into the light DOM, so the stylesheet and `--okp-*` overrides apply as they do everywhere else. That also means it is not style-isolated.

> **Upgrading from 0.2?** This package used to be the React component. It is now the no-framework build; React users want [`@oklch-picker/react`](https://www.npmjs.com/package/@oklch-picker/react).

## The family

| Using | Install |
| --- | --- |
| No framework: HTML, HTMX, Alpine, Astro, Rails, Laravel, Django | [`oklch-picker`](https://www.npmjs.com/package/oklch-picker) |
| React / Preact | [`@oklch-picker/react`](https://www.npmjs.com/package/@oklch-picker/react) |
| Vue | [`@oklch-picker/vue`](https://www.npmjs.com/package/@oklch-picker/vue) |
| Svelte 5 | [`@oklch-picker/svelte`](https://www.npmjs.com/package/@oklch-picker/svelte) |
| Solid | [`@oklch-picker/solid`](https://www.npmjs.com/package/@oklch-picker/solid) |
| Angular 17+ | [`@oklch-picker/angular`](https://www.npmjs.com/package/@oklch-picker/angular) |
| Qwik | [`@oklch-picker/qwik`](https://www.npmjs.com/package/@oklch-picker/qwik) |
| The maths and headless model alone | [`@oklch-picker/core`](https://www.npmjs.com/package/@oklch-picker/core) |

Full documentation lives in the [repository README](https://github.com/nord-forge/oklch-picker#readme).

## Licence

MIT © Nick Bevers
