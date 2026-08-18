import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  deps: {
    // The core is a real dependency, resolved by the consumer — not inlined,
    // so `oklch-picker` and `@oklch-picker/react` share one copy of it.
    neverBundle: [
      "@oklch-picker/core",
      "react",
      "react/jsx-runtime",
      "preact",
      "preact/jsx-runtime",
      "preact/hooks",
    ],
  },
});
