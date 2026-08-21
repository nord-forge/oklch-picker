import { defineConfig } from "vite";

export default defineConfig({
  // No Angular plugin. The adapter is published as `ngc` output with its
  // templates already compiled, and this app's own component compiles at
  // runtime via `@angular/compiler`, which the entry imports. That keeps the
  // example to one dependency-free Vite config rather than pulling the Angular
  // CLI into a monorepo that builds everything else with tsdown.
  optimizeDeps: { exclude: ["@oklch-picker/angular"] },
  server: { fs: { allow: [".", "../.."] } },
});
