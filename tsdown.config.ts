import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/colour.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  deps: {
    neverBundle: ["react", "react/jsx-runtime", "preact", "preact/jsx-runtime", "preact/hooks"],
  },
  copy: [{ from: "src/styles.css", to: "dist/" }],
});
