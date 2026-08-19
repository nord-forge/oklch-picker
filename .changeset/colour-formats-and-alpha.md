---
"@oklch-picker/core": minor
"@oklch-picker/react": minor
"@oklch-picker/svelte": minor
"@oklch-picker/solid": minor
"@oklch-picker/vue": minor
"oklch-picker": minor
---

Lead with OKLCH, add rgb, and support alpha

**Breaking, despite the minor bump.** 1.0.x is barely a week old and 1.1 already
carries several behaviour changes, so this stays a minor release rather than
making 2.0 arrive days after 1.0. Read this section before upgrading. Every
previous arrangement is still reachable by passing a prop.

**The hex field is off by default, and an `oklch()` field takes its place.**
OKLCH is what the picker works in and what it emits. Hex cannot represent what
this picker is for: it is sRGB only, so it cannot carry a P3 or Rec. 2020
colour at all. To keep the old footer:

```tsx
<ColourPicker value={colour} onChange={setColour} parts={{ hexInput: true }} />
```

`parts.oklchInput` is on, `parts.rgbInput` and `parts.hexInput` are off. Turn on
as many as you want; each is an editable field that accepts any of the three
formats regardless of which one it displays.

**Presets moved below the chart.** They sat above it, which pushed the plot down
and put a row of swatches between the heading and the control they belong to.

**Alpha is supported, with its own slider, on by default.** OKLCH carries alpha
and the picker used to drop it silently, so a value passed in with transparency
came back opaque. `parts={{ alpha: false }}` removes the slider.

An opaque colour is unchanged in every format. `oklch(0.7 0.15 255)` stays
exactly that, hex stays six digits, and `rgb()` stays three channels. The alpha
forms appear only when a colour is actually transparent, so nothing you have
stored changes on upgrade.

**New in the colour maths:** `formatRgb`, `parseRgb`, `oklchToRgb255`,
`hasAlpha` and `alphaOf`. `toOklch` now also accepts `rgb()` and `rgba()`
strings, and `hexToOklch` reads the `#rgba` and `#rrggbbaa` forms.

Alpha is deliberately not a fourth axis. It cannot move a colour in or out of
gamut, so it stays clear of the chart maths, the reachable-chroma search, and
the clamping, and it rides alongside the three axes instead.
