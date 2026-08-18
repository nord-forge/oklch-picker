import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** The published components use `lang="ts"`, so they need preprocessing here. */
export default { preprocess: vitePreprocess() };
