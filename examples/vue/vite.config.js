import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  // The package is linked with `file:`, so its dist is outside this root.
  server: { fs: { allow: [".", "../.."] } },
});
