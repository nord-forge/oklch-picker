# @oklch-picker/solid

## 1.1.1

### Patch Changes

- e8aea5a: Give each picker its own SVG gradient id

  Every chart built its gradient id from the class prefix and the axis, so two
  pickers on a page both emitted `oklch-picker-gamut-h`. SVG ids share one
  document-wide namespace, so the second picker's `fill="url(#...)"` resolved to
  the first one's gradient and its chart drew the wrong colours. Any page with
  more than one picker was affected, including the documentation site.

  Each adapter now takes a unique id from its framework's own hook: `useId` in
  React and Vue, `createUniqueId` in Solid, `$props.id()` in Svelte. Those are
  stable across a server render and the hydration that follows, so the fix does
  not trade one bug for a hydration mismatch. The custom element uses a module
  counter instead, which is safe there because it upgrades in the browser rather
  than being rendered to HTML on a server.

  Solid and Svelte count their ids per module, so pickers stay distinct however
  they are mounted. Vue and React count per app root, so two pickers mounted as
  separate roots on one page can still collide there. That is rare, and
  `classPrefix` is part of the id, so a different prefix separates them today.

  - @oklch-picker/core@1.1.1

## 1.1.0

### Minor Changes

- a1cd744: Lead with OKLCH, add rgb, and support alpha

  **Breaking, despite the minor bump.** 1.0.x is barely a week old and 1.1 already
  carries several behaviour changes, so this stays a minor release rather than
  making 2.0 arrive days after 1.0. Read this section before upgrading. Every
  previous arrangement is still reachable by passing a prop.

  **The hex field is off by default, and an `oklch()` field takes its place.**
  OKLCH is what the picker works in and what it emits. Hex cannot represent what
  this picker is for: it is sRGB only, so it cannot carry a P3 or Rec. 2020
  colour at all. To keep the old footer:

  ```tsx
  <ColourPicker
    value={colour}
    onChange={setColour}
    parts={{ hexInput: true }}
  />
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

- 7873292: Add a `chart` layout, make it the default, and make the gamut charts real 2D
  slices

  **Behaviour change: the default layout is now `chart`, not `stacked`.** A picker
  given no `layout` renders one large lightness x chroma plot above the three
  sliders rather than a thin chart above each. `side-by-side` shows the same
  single plot. Pass `layout="stacked"` to keep what 1.0 rendered:

  ```tsx
  <ColourPicker value={colour} onChange={setColour} layout="stacked" />
  ```

  This is a minor release because the API is unchanged and every previous
  arrangement is still reachable by name. It does change what an existing app
  draws without asking, though, so it is worth a look before upgrading.

  Each chart now sweeps the two axes it does not itself control, so the three are
  genuinely different views: the L chart plots hue against chroma, the C chart hue
  against lightness, and the H chart lightness against chroma. Previously the C
  and H charts both swept chroma against hue and drew an identical curve.

  The single large plot is draggable, setting lightness and chroma at once, using
  pointer events so it works under touch. The thin per-axis charts in `stacked`
  stay read-only: a 34px strip gives a drag almost no vertical travel, and it
  would set two axes at once directly above the slider that sets one precisely.

  The sliders remain the accessible input path, and `parts.charts` turns the
  charts off like any other part.

  **Fixed: the near-black gamut was reported wrongly.** `inGamut` applied its
  tolerance to linear light, which is worth about 1.6/255 near black but 0.06/255
  near white, so it accepted chroma that quantises to plain `#000000`. The picker
  would sit on a colour it could not display, draw the crosshair above the curve,
  and show no out-of-gamut notice. The tolerance is now applied to the encoded
  channel, and a colour counts as displayable only if it survives 8-bit
  quantisation as something other than grey. The gamut therefore closes to a
  point at black, as it already did at white. This removes a `maxChroma`
  workaround that hard-zeroed every chroma below L=0.06, which had zeroed a real
  region.

- 994943c: Remember recently used colours

  A row of recently committed colours, on by default and empty until something is
  committed, so it shows nothing until it has something to show. Each picker
  keeps its own list for the session.

  To store them yourself, in a backend or shared between pickers, pass `recents`
  and take the updates from `onRecentsChange`. That is the same controlled shape
  `value` and `onChange` already use.

  A colour joins the list when it is **committed**: a pointer release, a preset
  click, a hex entry, or leaving a slider. Not on every value a drag passes
  through. Dragging the hue slider across the spectrum records one colour rather
  than forty. Repeats move to the front instead of appearing twice, and the list
  is capped at `maxRecents`, 8 by default.

  `parts.recents` removes the row, and `addRecent` is exported for callers doing
  their own bookkeeping.

- 21db4bb: Add Display P3 and Rec. 2020 as output gamuts, behind their own entry point

  Pass `gamut` to work in a wider space than sRGB:

  ```tsx
  import { P3 } from "@oklch-picker/core/gamuts";

  <ColourPicker value={colour} onChange={setColour} gamut={P3} />;
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

### Patch Changes

- 99ee58b: Plot the chart in the output gamut, not always sRGB

  Passing `gamut={P3}` widened the chroma slider and clamped correctly, but the
  chart's filled silhouette was still computed against sRGB. A wider space only
  added a dotted outline while the plot underneath never moved, which read as the
  gamut being ignored.

  `gamutChartModel` now takes the output gamut and computes the filled curve from
  it. The reference outlines are converted onto the chart's scale first, since
  every curve arrives normalised by its own space's `chartMaxChroma`. Without
  that, drawing them together compared different scales and could place a
  narrower gamut's outline above a wider one.

  The chart's vertical scale is now the widest space in view, output or
  reference, rather than each curve normalising to its own peak. Scaling per
  gamut made Rec. 2020 draw _lower_ than P3 despite reaching further, because its
  curve was divided by a larger number. Height now means absolute reach, so a
  wider gamut genuinely draws taller. A Rec. 2020 picker uses less of the chart's
  height as a result, which is the honest depiction. `chartScale` is exported for
  anyone drawing their own.

  `chartSlot` and `chartPick` both take the references, so the crosshair sits on
  the same scale the curve is drawn on. They previously disagreed: picking
  converted on sRGB's scale while the crosshair was positioned on the shared one,
  so a drag was aligned at the bottom of the plot and drifted further the higher
  the pointer went, in proportion to the ratio between the two.

  Only spaces narrower than the output draw a line. A line for the output itself
  would trace its own boundary, and a wider one would mark colours the picker
  cannot reach, which says nothing about where its safe region ends. Passing a
  whole list to every picker is therefore safe: each keeps the ones that apply.
  The switcher still offers every space it was given, since building its choices
  from the drawn lines would make switching up from sRGB impossible.

  Worth knowing when comparing spaces: P3 extends mostly in greens and reds. At a
  blue hue like 255 it reaches about 8% further than sRGB, so the difference is
  genuinely small there, while at green 145 it is closer to 36%.

- 108ef57: Punctuate the out-of-gamut notices with a comma rather than a dash

  The sRGB notice now reads "Outside sRGB, the nearest sRGB colour is used." A
  dash used to sit where the comma is. Every other space changed the same way.

  Only the punctuation changes. The wording, the keys, and the clamping are all
  untouched, and an app that overrides `labels.outOfGamut` or `outOf:<id>` sees
  nothing different. It matters only if you assert on the exact default string in
  a test.

- 99ee58b: Stop recording an out-of-gamut colour in recents

  Releasing a drag in a hatched region added an entry. The commit path ran the
  dialled colour through `emitValue`, which clamps, so the list filed the nearest
  reachable colour under a colour nobody chose. Repeated drags into the same
  unreachable region stacked near-identical swatches.

  A commit outside the output gamut now records nothing. `recentValue` is
  exported for callers doing their own bookkeeping: it returns the canonical
  string, or null when the colour is not reachable.

  What counts as reachable follows the output gamut, so a colour inside P3 but
  outside sRGB records for a P3 picker and not for an sRGB one. `onChange` is
  unaffected and still emits the clamped value on every move.

- Updated dependencies [99ee58b]
- Updated dependencies [a1cd744]
- Updated dependencies [108ef57]
- Updated dependencies [7873292]
- Updated dependencies [994943c]
- Updated dependencies [99ee58b]
- Updated dependencies [21db4bb]
  - @oklch-picker/core@1.1.0

## 1.0.1

### Patch Changes

- Ship the README and licence that 1.0.0 was missing.

  Both files were listed in each package's `files` field but did not exist, so
  1.0.0 published with a blank npm page and no licence text in the tarball. Each
  package now carries its own README — its install line, its usage, and a table
  pointing at the rest of the family — alongside the MIT licence.

  Package metadata is completed at the same time: `homepage`, `bugs`, and an
  author email, none of which 1.0.0 had.

  No code changes.

- Updated dependencies
  - @oklch-picker/core@1.0.1

## 1.0.0

### Major Changes

- aba8ca4: Framework adapters for Vue, Svelte, Solid, and no framework at all, published as
  scoped packages so an app installs only the adapter it uses.

  - `oklch-picker` — a `<oklch-picker>` custom element with no framework
    and no build step, covering plain HTML, HTMX, Alpine, Astro, and any
    server-rendered page. Form-associated, so it submits under its `name` like a
    built-in input, and its `change` event is typed for `event.detail.colour`.
  - `@oklch-picker/vue` (`v-model`), `@oklch-picker/svelte` (`bind:value`, Svelte 5
    runes), and `@oklch-picker/solid`, each on the same headless model and
    stylesheet as the React component.
  - `@oklch-picker/core` — the colour maths, headless model, and stylesheet, now
    installable on its own for server-side colour work. Ships a minified
    `styles.min.css` (1.3 kB gzipped against 2.3 kB) for the no-build path.

  **Breaking: `oklch-picker` is now the no-framework build.** It was the React
  component; it is now the `<oklch-picker>` custom element, so that `npm i
oklch-picker` gives the version that works anywhere. React users move to
  `@oklch-picker/react`:

  | Was                       | Now                             |
  | ------------------------- | ------------------------------- |
  | `oklch-picker`            | `@oklch-picker/react`           |
  | `oklch-picker/vue`        | `@oklch-picker/vue`             |
  | `oklch-picker/svelte`     | `@oklch-picker/svelte`          |
  | `oklch-picker/solid`      | `@oklch-picker/solid`           |
  | `oklch-picker/vanilla`    | `oklch-picker`                  |
  | `oklch-picker/colour`     | `@oklch-picker/core`            |
  | `oklch-picker/styles.css` | `@oklch-picker/core/styles.css` |

### Patch Changes

- Updated dependencies [aba8ca4]
  - @oklch-picker/core@1.0.0
