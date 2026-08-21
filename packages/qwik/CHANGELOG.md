# @oklch-picker/qwik

## 1.2.0

### Minor Changes

- 8b44add: Read and write `hsl()` and `hwb()`.

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

- 09c12e1: Add a Qwik adapter.

  `@oklch-picker/qwik` takes `value` and `onChange$`, the QRL form Qwik uses for
  every handler, and the same props as every other adapter because all of them
  read the same headless model.

  One thing differs, and it is worth knowing before you reach for it. Gamuts are
  named rather than passed: `gamut="p3"`, not `gamut={P3}`. Qwik serialises props
  so the client can resume a component without re-running it, and a `Gamut`
  carries `fromLms`, the matrix that defines the colour space. A function cannot
  be serialised, so the object would fail the moment a real page resumed. An id is
  a string, and the adapter resolves the gamut on the other side. `references` and
  `gamutChoices` take ids too.

  The package ships JSX source so your build's optimizer can split the `$()`
  boundaries. Pre-bundling would freeze them into one chunk and defeat
  resumability.

  Lit, Alpine and HTMX were considered and need no adapter. The custom element
  already works in all three, and `/docs/recipes` covers the wiring each one
  needs.

### Patch Changes

- 834bd7e: Fix the gamut maths, the chart memo, and three accessibility gaps.

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

- dad01a6: Draw the P3 line on a Rec. 2020 picker, and label the recents row.

  A Rec. 2020 picker outlined sRGB and left P3 unmarked, so the two widest steps
  in the chart ran together as one region. It named only sRGB because the default
  reference list was written before P3 existed as an output space, and `model.ts`
  cannot import P3 to fix that without pulling its matrices into every bundle.

  A `Gamut` now names the narrower spaces worth outlining, and Rec. 2020 names P3.
  Nothing changes for callers who pass `references` or `gamutChoices`
  explicitly, and an sRGB-only app still ships neither matrix.

  The recents row had no heading, so a second grid of colour appeared under the
  presets with nothing saying it was history rather than more of the offer. It
  reads "Recently used", from `labels.recents`, so it translates with everything
  else. Presets keep no label: they are the only swatches on screen until
  something has been committed.

- Updated dependencies [4fc19a6]
- Updated dependencies [834bd7e]
- Updated dependencies [8b44add]
- Updated dependencies [09c12e1]
- Updated dependencies [dad01a6]
  - @oklch-picker/core@1.2.0
