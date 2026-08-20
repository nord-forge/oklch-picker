import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  deps: {
    // The core is a real dependency, resolved by the consumer, not inlined, so
    // every adapter on a page shares one copy of it.
    neverBundle: ["@oklch-picker/core", "@angular/core", "@angular/common"],
  },
});
