---
"@oklch-picker/core": minor
"@oklch-picker/react": minor
"@oklch-picker/svelte": minor
"@oklch-picker/solid": minor
"@oklch-picker/vue": minor
"oklch-picker": minor
---

Remember recently used colours

A row of recently committed colours, on by default and empty until something is
committed, so it shows nothing until it has something to show. Each picker
keeps its own list for the session.

To store them yourself — in a backend, or shared between pickers — pass
`recents` and take the updates from `onRecentsChange`, the same controlled
shape `value` and `onChange` already use.

A colour joins the list when it is **committed**: a pointer release, a preset
click, a hex entry, or leaving a slider. Not on every value a drag passes
through — dragging the hue slider across the spectrum records one colour rather
than forty. Repeats move to the front instead of appearing twice, and the list
is capped at `maxRecents`, 8 by default.

`parts.recents` removes the row, and `addRecent` is exported for callers doing
their own bookkeeping.
