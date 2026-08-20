<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="72" height="72">
</picture>

# @oklch-picker/qwik

An OKLCH colour picker for **Qwik**, with gamut-aware sliders.

**[Documentation and live demos](https://nord-forge.github.io/oklch-picker/)**

Every axis is a slider over a **gamut cross-section**. The filled silhouette is the range sRGB can actually show, so the reachable colours are visible. You do not have to discover them by dragging into a region that does nothing.

**[See it running](https://nord-forge.github.io/oklch-picker/)**, in light or dark, with every layout and part on a page of its own.

- **The chroma slider is bounded by what is reachable.** A fixed `0..0.37` slider is up to **87% dead travel** at low lightness. Here the maximum is recomputed as the other axes move.
- **Out-of-gamut regions are hatched**, on every axis.
- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing chroma, keeping lightness and hue.

## Install

```sh
npm install @oklch-picker/qwik
```

## Usage

```tsx
import { component$, useSignal } from "@builder.io/qwik";
import { ColourPicker } from "@oklch-picker/qwik";
import "@oklch-picker/core/styles.css";

export const Example = component$(() => {
  const colour = useSignal("oklch(0.7 0.15 255)");
  return (
    <ColourPicker
      value={colour.value}
      onChange$={(c) => {
        colour.value = c;
      }}
    />
  );
});
```

`onChange$` carries a canonical, gamut-clamped `oklch(L C H)` string.

## Gamuts are named, not passed

This is the one place the API differs from the other adapters. Everywhere else you write `gamut={P3}`. Here you write:

```tsx
<ColourPicker value={colour.value} gamut="p3" onChange$={(c) => (colour.value = c)} />
```

The reason is resumability. Qwik serialises a component's props so the client can resume it without re-running anything, and a `Gamut` carries `fromLms`, the matrix that defines the colour space. A function cannot be serialised, so passing the object fails with `Value cannot be serialized`.

An id is a string, so it crosses the boundary and the adapter resolves the real gamut on the other side. `references` and `gamutChoices` take ids too:

```tsx
<ColourPicker
  value={colour.value}
  gamut={gamut.value}
  gamutChoices={["srgb", "p3", "rec2020"]}
  parts={{ gamutSwitch: true }}
  onChange$={(c) => (colour.value = c)}
  onGamutChange$={(g) => (gamut.value = g)}
/>
```

The trade is that importing the adapter ships all three colour spaces rather than only the ones you use. That is a few hundred bytes of matrices, and the alternative is a prop that works in development and fails the moment a real page resumes.

## Server rendering

Nothing to configure. The server sends the finished picker, sliders and chart and value, and the client resumes it:

```tsx
import { renderToString } from "@builder.io/qwik/server";

await renderToString(<Example />);
```

## Ships source, not a build

Qwik's optimizer has to see the `$()` boundaries to split them into separately loadable chunks. Pre-bundling here would freeze them into one chunk and defeat resumability, so the package ships JSX source and your build compiles it.

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
