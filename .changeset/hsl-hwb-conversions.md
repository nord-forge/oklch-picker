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

Neither can carry a wide-gamut colour, so both clamp into the output gamut on
the way out. A P3 colour written as `hsl()` is the nearest sRGB one, which is
the same trade hex already makes.
