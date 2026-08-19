<script>
  import { ColourPicker } from "@oklch-picker/svelte";

  const LAYOUTS = ["chart", "side-by-side", "compact", "stacked"];
  const PRESETS = [
    "oklch(0.72 0.19 35)",
    "oklch(0.8 0.17 85)",
    "oklch(0.75 0.16 145)",
    "oklch(0.7 0.15 255)",
    "oklch(0.65 0.22 305)",
  ];

  // `bind:value` writes straight back into this rune.
  let colour = $state("oklch(0.7 0.15 255)");
  let layout = $state("chart");
</script>

<main class="demo">
  <header class="demo__head">
    <h1 class="demo__title">oklch-picker — Svelte</h1>
    <p class="demo__subtitle">
      Bound with <code class="demo__code">bind:value</code>; an
      <code class="demo__code">onchange</code> callback is available too.
    </p>
  </header>

  <div class="demo__layouts">
    {#each LAYOUTS as l (l)}
      <button
        type="button"
        class="demo__layout"
        aria-pressed={l === layout}
        onclick={() => (layout = l)}
      >
        {l}
      </button>
    {/each}
  </div>

  <div class="demo__panel">
    <ColourPicker bind:value={colour} {layout} presets={PRESETS} />
  </div>

  <p class="demo__value">
    <span class="demo__swatch" style:background={colour}></span>
    <code class="demo__code">{colour}</code>
  </p>
</main>
