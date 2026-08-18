import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  // The adapter ships as JSX source so it compiles with the app's own Solid
  // runtime; pre-bundling it would compile the JSX with the wrong pragma.
  optimizeDeps: { exclude: ["oklch-picker"] },
  server: { fs: { allow: [".", "../.."] } },
});
