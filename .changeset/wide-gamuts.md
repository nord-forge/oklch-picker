---
"@oklch-picker/core": minor
"@oklch-picker/react": minor
"@oklch-picker/svelte": minor
"@oklch-picker/solid": minor
"@oklch-picker/vue": minor
"oklch-picker": minor
---

Add Display P3 and Rec. 2020 as output gamuts, behind their own entry point

Pass `gamut` to work in a wider space than sRGB:

```tsx
import { P3 } from "@oklch-picker/core/gamuts";

<ColourPicker value={colour} onChange={setColour} gamut={P3} />
```

That is the output space, not decoration: the chroma slider reaches further,
the value is clamped to P3 rather than sRGB, and the notice only fires once a
colour leaves P3 too. sRGB is outlined on the chart as a reference whenever it
is not itself the output.

The matrices live in `@oklch-picker/core/gamuts` rather than the main entry, so
an app that never imports them never ships them. The bundler drops the module
statically, with no dynamic import and nothing async in the render path.

`parts.gamutSwitch` (off by default) renders a segmented control for switching
the output space, driven by `gamutChoices` and `onGamutChange`. It hides itself
when that leaves only one option.

The default sRGB notice is reworded from "Outside what a screen can display" to
"Outside sRGB, the nearest sRGB colour is used." The old phrasing was only true
while sRGB was the only option, and P3 is a screen too. Every space now names
itself. Apps overriding `labels.outOfGamut` are unaffected.

Notices are resolved per output gamut: override `outOfGamut` for the general
case or `outOf:p3` for one space, or turn the text off with `parts.notice`
without changing the clamping. Nothing changes for an app that does not pass
`gamut`.

The gamut bisection bound is now per space. It was a single sRGB-shaped
constant, and Rec. 2020 reaches chroma ~0.464, well past it. Its boundary would
have been silently clipped.
