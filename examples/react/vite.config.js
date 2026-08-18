import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // The package is linked with `file:`, so its dist is outside this root.
  server: { fs: { allow: [".", "../.."] } },
});
