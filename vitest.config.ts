import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: false,
  },
  // Vitest 4 transforms with oxc, not esbuild.
  oxc: {
    jsx: { runtime: "automatic", importSource: "preact" },
  },
  resolve: {
    // Tests render the component with Preact, proving the single React-API
    // build genuinely works there rather than merely claiming to.
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
});
