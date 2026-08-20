<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-dark.svg">
  <img src="https://raw.githubusercontent.com/nord-forge/oklch-picker/main/docs/media/mark-light.svg" alt="" width="72" height="72">
</picture>

# @oklch-picker/angular

An OKLCH colour picker for **Angular**, with gamut-aware sliders.

**[Documentation and live demos](https://nord-forge.github.io/oklch-picker/)**

Every axis is a slider over a **gamut cross-section**. The filled silhouette is the range sRGB can actually show, so the reachable colours are visible. You do not have to discover them by dragging into a region that does nothing.

**[See it running](https://nord-forge.github.io/oklch-picker/)**, in light or dark, with every layout and part on a page of its own.

- **The chroma slider is bounded by what is reachable.** A fixed `0..0.37` slider is up to **87% dead travel** at low lightness. Here the maximum is recomputed as the other axes move.
- **Out-of-gamut regions are hatched**, on every axis.
- **Nothing out-of-gamut is ever emitted.** Values are clamped by reducing chroma, keeping lightness and hue.

## Install

```sh
npm install @oklch-picker/angular
```

Angular 17 or newer. Standalone components and signals are both stable there. On an older version, use the [`oklch-picker`](https://www.npmjs.com/package/oklch-picker) custom element instead: it needs no framework at all and works in any Angular app.

## Usage

A standalone, `OnPush` component built on signals, so it needs no zone-based change detection.

```ts
import { Component, signal } from "@angular/core";
import { ColourPickerComponent } from "@oklch-picker/angular";
import "@oklch-picker/core/styles.css";

@Component({
  selector: "app-example",
  standalone: true,
  imports: [ColourPickerComponent],
  template: `
    <oklch-colour-picker
      [value]="colour()"
      (valueChange)="colour.set($event)"
    />
  `,
})
export class ExampleComponent {
  readonly colour = signal("oklch(0.7 0.15 255)");
}
```

`valueChange` carries a canonical, gamut-clamped `oklch(L C H)` string. Pair it with `[value]` for the usual controlled component, exactly as you would with any Angular input and output.

### Presets and recent colours

```ts
template: `
  <oklch-colour-picker
    [value]="colour()"
    [presets]="['oklch(0.75 0.16 145)', 'oklch(0.7 0.15 255)']"
    (valueChange)="colour.set($event)"
    (recentsChange)="save($event)"
  />
`
```

### A wider gamut

```ts
import { P3 } from "@oklch-picker/core/gamuts";

// The gamut is the output space: the sliders reach further, and the value is
// clamped to the space you chose.
template: `<oklch-colour-picker [value]="colour()" [gamut]="P3" (valueChange)="colour.set($event)" />`
```

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
