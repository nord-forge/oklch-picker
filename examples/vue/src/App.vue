<script setup>
import { ColourPicker } from "@oklch-picker/vue";
import { ref } from "vue";

const LAYOUTS = ["chart", "side-by-side", "compact", "stacked"];
const PRESETS = [
  "oklch(0.72 0.19 35)",
  "oklch(0.8 0.17 85)",
  "oklch(0.75 0.16 145)",
  "oklch(0.7 0.15 255)",
  "oklch(0.65 0.22 305)",
];

// `v-model` writes straight back into this ref.
const colour = ref("oklch(0.7 0.15 255)");
const layout = ref("chart");
</script>

<template>
  <main class="demo">
    <header class="demo__head">
      <h1 class="demo__title">oklch-picker — Vue</h1>
      <p class="demo__subtitle">
        Bound with <code class="demo__code">v-model</code>; a
        <code class="demo__code">change</code> event is emitted too.
      </p>
    </header>

    <div class="demo__layouts">
      <button
        v-for="l in LAYOUTS"
        :key="l"
        type="button"
        class="demo__layout"
        :aria-pressed="l === layout"
        @click="layout = l"
      >
        {{ l }}
      </button>
    </div>

    <div class="demo__panel">
      <ColourPicker v-model="colour" :layout="layout" :presets="PRESETS" />
    </div>

    <p class="demo__value">
      <span class="demo__swatch" :style="{ background: colour }" />
      <code class="demo__code">{{ colour }}</code>
    </p>
  </main>
</template>
