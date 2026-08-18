import { defineConfig } from "astro/config";

export default defineConfig({
  // The package is linked with `file:`, so its dist is outside this root.
  vite: { server: { fs: { allow: [".", "../.."] } } },
});
