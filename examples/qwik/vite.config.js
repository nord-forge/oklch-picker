import { qwikVite } from "@builder.io/qwik/optimizer";
import { defineConfig } from "vite";

export default defineConfig({
  // The optimizer is not optional: `$()` is a build-time marker rather than a
  // runtime function, and without the plugin every `component$` throws.
  // `client.input` because the plugin otherwise looks for `src/root`, which is
  // the convention in a Qwik City app rather than a plain Vite one.
  plugins: [qwikVite({ client: { input: "src/main.tsx" } })],
  // The adapter ships JSX source so the optimizer can split its `$()`
  // boundaries here. Pre-bundling would freeze them into one chunk.
  optimizeDeps: { exclude: ["@oklch-picker/qwik"] },
  server: { fs: { allow: [".", "../.."] } },
});
