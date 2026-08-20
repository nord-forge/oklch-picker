---
"@oklch-picker/core": patch
"@oklch-picker/react": patch
"@oklch-picker/svelte": patch
"@oklch-picker/solid": patch
"@oklch-picker/vue": patch
"oklch-picker": patch
---

Plot the chart in the output gamut, not always sRGB

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
gamut made Rec. 2020 draw *lower* than P3 despite reaching further, because its
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
