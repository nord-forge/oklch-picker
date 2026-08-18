import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** Only needed to compile `lang="ts"` blocks in tests and svelte-check;
 * published `.svelte` source is compiled by the consumer's own tooling. */
export default { preprocess: vitePreprocess() };
