---
"@oklch-picker/core": minor
"@oklch-picker/react": minor
"@oklch-picker/svelte": minor
"@oklch-picker/solid": minor
"@oklch-picker/vue": minor
"oklch-picker": minor
---

Add a `chart` layout, make it the default, and make the gamut charts real 2D
slices

**Behaviour change: the default layout is now `chart`, not `stacked`.** A picker
given no `layout` renders one large lightness x chroma plot above the three
sliders rather than a thin chart above each. `side-by-side` shows the same
single plot. Pass `layout="stacked"` to keep what 1.0 rendered:

```tsx
<ColourPicker value={colour} onChange={setColour} layout="stacked" />
```

This is a minor release because the API is unchanged and every previous
arrangement is still reachable by name — but it does change what an existing
app draws without asking, so it is worth a look before upgrading.

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
quantisation as something other than grey — so the gamut closes to a point at
black, as it already did at white. This removes a `maxChroma` workaround that
hard-zeroed every chroma below L=0.06, which had zeroed a real region.
