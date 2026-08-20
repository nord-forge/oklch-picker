---
"@oklch-picker/angular": minor
"@oklch-picker/core": minor
"@oklch-picker/react": minor
"@oklch-picker/solid": minor
"@oklch-picker/svelte": minor
"@oklch-picker/vue": minor
"oklch-picker": minor
---

Add an Angular adapter.

`@oklch-picker/angular` is a standalone, `OnPush` component built on signals, so
it needs no zone-based change detection. It binds with `[value]` and
`(valueChange)`, the usual Angular pair, and takes the same props as every other
adapter because all of them read the same headless model.

Angular 17 or newer, where standalone components and signals are both stable. On
an older version, use the `oklch-picker` custom element instead. It needs no
framework and works in any Angular app.

Every package also gained npm keywords and a clearer description, so the picker
is findable by searching for what it is rather than by knowing its name.
