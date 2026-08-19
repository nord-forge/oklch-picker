---
"@oklch-picker/core": patch
"@oklch-picker/react": patch
"@oklch-picker/svelte": patch
"@oklch-picker/solid": patch
"@oklch-picker/vue": patch
"oklch-picker": patch
---

Punctuate the out-of-gamut notices with a comma rather than a dash

The sRGB notice now reads "Outside sRGB, the nearest sRGB colour is used." A
dash used to sit where the comma is. Every other space changed the same way.

Only the punctuation changes. The wording, the keys, and the clamping are all
untouched, and an app that overrides `labels.outOfGamut` or `outOf:<id>` sees
nothing different. It matters only if you assert on the exact default string in
a test.
