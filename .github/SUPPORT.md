# Support

Start with the [README](https://github.com/nord-forge/oklch-picker#readme). It
covers install and usage for every framework, the theming variables, and the
three layouts. If it is not answered there, open an
[issue](https://github.com/nord-forge/oklch-picker/issues/new/choose).

## Frequently asked

### Which package do I install?

One per framework, so you only download the adapter you use:

| Using | Install |
| --- | --- |
| No framework (HTML, HTMX, Alpine, Astro, Rails, Laravel, Django) | `oklch-picker` |
| React or Preact | `@oklch-picker/react` |
| Vue | `@oklch-picker/vue` |
| Svelte 5 | `@oklch-picker/svelte` |
| Solid | `@oklch-picker/solid` |
| Just the colour maths, no UI | `@oklch-picker/core` |

The stylesheet always comes from the core, which every adapter already depends
on: `import "@oklch-picker/core/styles.css"`.

### I was using `oklch-picker` for React and it broke

`oklch-picker` used to be the React component. As of 1.0 it is the
no-framework custom element, so that `npm i oklch-picker` gives the build that
works anywhere. Install `@oklch-picker/react` and change the import. The
component, its props, and its values are otherwise unchanged.

### Why is the chroma slider's maximum always moving?

Because the sRGB gamut is a lopsided solid in OKLCH: the most saturated colour
you can actually display depends on both lightness and hue. A fixed `0..0.37`
slider is up to 87% dead travel at low lightness. The thumb moves and nothing
changes. The maximum is recomputed as the other axes move, so the track stays
useful.

### Why does my colour come back slightly different from what I set?

Everything emitted is clamped into sRGB by reducing chroma, keeping lightness
and hue. If you set a colour no screen can show, you get the nearest one that
can be. `inGamut()` from `@oklch-picker/core` tells you in advance.

### Can I change how it looks?

Yes, without overriding any of the CSS:

- **`--okp-*` custom properties** for colours, sizes, and radii.
- **`layout`** takes `stacked` (default), `compact`, or `side-by-side`.
- **`parts`** to turn off the charts, preview, hex input, name, or notice.
- **`classPrefix`** to rename every class, if you would rather style it yourself.

For something further from the default, `@oklch-picker/core` exposes the whole
headless model, meaning axis ranges, gradients, and chart geometry. You can
build your own markup on the same maths.

### Does it work without JavaScript?

No. It is an interactive control. The custom element does render a plain
`value` attribute server-side, and being form-associated it submits under its
`name` like a built-in input, so a server-rendered form round-trips without any
JavaScript of your own.

### Which browsers?

Anything supporting `light-dark()` in CSS: Chrome/Edge 123+, Safari 17.5+,
Firefox 120+. Override the `--okp-*` colour variables to support older ones.

### Why British spelling?

`colour`, `colourName`, `ColourPicker` throughout. The CSS custom properties are
the exception, since `--okp-*` is neither.

## Reporting a security issue

Please do not open a public issue. See
[SECURITY.md](https://github.com/nord-forge/oklch-picker/blob/main/.github/SECURITY.md).
