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

Draw the P3 line on a Rec. 2020 picker, and label the recents row.

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
