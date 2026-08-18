import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  // The adapter ships as `.svelte` source, so it must be compiled here rather
  // than treated as a pre-built dependency.
  optimizeDeps: { exclude: ["oklch-picker"] },
  server: { fs: { allow: [".", "../.."] } },
});
