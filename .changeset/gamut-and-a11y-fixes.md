---
"@oklch-picker/angular": patch
"@oklch-picker/core": patch
"@oklch-picker/qwik": patch
"@oklch-picker/react": patch
"@oklch-picker/solid": patch
"@oklch-picker/svelte": patch
"@oklch-picker/vue": patch
"oklch-picker": patch
---

Fix the gamut maths, the chart memo, and three accessibility gaps.

**Nothing out of gamut is emitted, for the string as well as the object.** The
clamp landed just inside the boundary and formatting rounded chroma back out of
it, so a picker fed its own emitted value showed the out-of-gamut notice. The
clamp now floors to the precision the string keeps.

**`inGamut` no longer flickers.** It rounded a colour and its grey to 8 bits
before comparing them, which is not monotonic in chroma, so the bisection could
converge in a dead zone and report a maximum below what `inGamut` itself
accepted. It now measures that separation before rounding.

**The chart curve is memoised again.** `pickerModel` returned a fresh array of
the same gamuts on every call, so the memo comparing them missed every time and
the curve and its gradient stops were rebuilt on every pointer move. Six of the
seven adapters were affected.

**Sliders say what their values mean.** Every axis and the alpha slider carry
`aria-valuetext`. Chroma names the maximum it is measured against, which moves
with lightness and hue, so the bare number said nothing on its own.

**Gamut clamping is announced.** The out-of-gamut notice is a live region that
stays in the DOM and empties, rather than appearing when it has something to
say, which is too late for a screen reader to notice it.

**Recent swatches and slider tracks meet the 24px target size**, and the
boundaries of the value fields, preview and gamut switch now meet 3:1 contrast.
Recent swatches grow from 18px; the slider's hit area grows without moving the
thumb, track, chart or crosshair.

Qwik's `gamut` prop falls back to sRGB for any unrecognised id, including
inherited property names like `constructor`, which used to throw. Angular's
generated ids no longer drift between server renders, which broke the chart
gradient on hydration.

Chart `resolution` is capped, so a large value can no longer freeze a drag or
block the server's event loop, and `clampToGamut` no longer carries a negative
chroma through. `alphaModel`, `alphaTrack`, the `AlphaModel` type and
`oklchToLms` are exported, having been unreachable from the entry point.
