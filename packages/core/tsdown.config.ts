import { defineConfig } from "tsdown";

/** The shared layer, plus the stylesheet every adapter's consumers import. */
export default defineConfig({
  entry: ["src/index.ts", "src/colour.ts", "src/gamuts.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  copy: [{ from: "src/styles.css", to: "dist/" }],
  hooks: {
    // Minified twin for the no-build path: `oklch-picker` is served
    // straight from a CDN, where nothing else will compress it. Bundler users
    // keep importing `styles.css` — their build minifies it anyway, and the
    // readable file is the reference for the `--okp-*` variables.
    "build:done": async () => {
      const { readFile, writeFile } = await import("node:fs/promises");
      const { transform } = await import("lightningcss");
      const { code } = transform({
        filename: "styles.css",
        code: await readFile("src/styles.css"),
        minify: true,
        // No transpiling down: the stylesheet deliberately targets browsers
        // with `light-dark()`, and lowering it would change what ships.
      });
      await writeFile("dist/styles.min.css", code);
    },
  },
});
