---
"@oklch-picker/angular": minor
"@oklch-picker/core": minor
"@oklch-picker/qwik": minor
"@oklch-picker/react": minor
"@oklch-picker/solid": minor
"@oklch-picker/svelte": minor
"@oklch-picker/vue": minor
"oklch-picker": minor
---

Read and write `hsl()` and `hwb()`.

`parseHsl`, `formatHsl`, `parseHwb` and `formatHwb` join the `rgb()` and hex
pairs already in the core, and `toOklch` accepts both, so `value` now takes any
of `oklch()`, `rgb()`, `hsl()`, `hwb()` or hex. Every picker inherits that,
since they all read the same parser.

Both forms follow CSS Color 4: hue wraps and accepts `deg`, components clamp
rather than fail, alpha arrives as a fraction or a percentage in either the
comma or the space form, and `hwb()` whiteness and blackness summing past 100%
give the grey their ratio describes rather than an error.

Neither can carry a wide-gamut colour, so both clamp to sRGB on the way out. A
P3 colour written as `hsl()` is the nearest sRGB one, which is the same trade
hex already makes, and the docs now say so where someone choosing a wider gamut
will read it.

**`formatRgb` no longer takes a `gamut`.** It never could honour one: a browser
reads `rgb()` numbers as sRGB, so passing a wider space wrote channels that
render as a different colour. `pickerModel` was doing exactly that, and a P3
picker's `rgb()` field disagreed with its own hex field beside it, one saying
`rgb(0 253 63)` and the other `#01fb48`. Both now say the same colour.

Passing a second argument was already meaningless, so most callers need no
change; anyone who did pass one was getting a string that did not mean what it
said. `formatHsl` and `formatHwb` take no gamut for the same reason.
