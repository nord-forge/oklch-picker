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

Add a Qwik adapter.

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
