---
"@oklch-picker/core": patch
"@oklch-picker/react": patch
"@oklch-picker/svelte": patch
"@oklch-picker/solid": patch
"@oklch-picker/vue": patch
"oklch-picker": patch
---

Stop recording an out-of-gamut colour in recents

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
