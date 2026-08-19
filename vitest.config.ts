import { svelte } from "@sveltejs/vite-plugin-svelte";
import vue from "@vitejs/plugin-vue";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/** One project per package: each needs its own JSX transform or compiler, and
 * they cannot share a single config (Solid and Preact both claim JSX).
 *
 * Tests run against the workspace source, resolved through the same
 * `@oklch-picker/*` specifiers a consumer uses. npm workspaces symlink them,
 * so a broken `exports` map fails here rather than after publishing. */
export default defineConfig({
  test: {
    projects: [
      {
        // The React-API build, rendered with Preact via the compat alias.
        // That proves the single build genuinely works there.
        test: {
          name: "react",
          environment: "happy-dom",
          include: ["test/{ColourPicker,GamutChart}.test.tsx", "test/colour.test.ts"],
        },
        // Vitest 4 transforms with oxc, not esbuild.
        oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
        resolve: {
          alias: {
            react: "preact/compat",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime",
          },
        },
      },
      {
        test: {
          name: "vanilla",
          environment: "happy-dom",
          include: ["test/vanilla.test.ts"],
        },
      },
      {
        plugins: [vue()],
        test: {
          name: "vue",
          environment: "happy-dom",
          include: ["test/vue.test.ts"],
        },
      },
      {
        plugins: [solid()],
        resolve: { conditions: ["development", "browser"] },
        test: {
          name: "solid",
          environment: "happy-dom",
          include: ["test/solid.test.tsx"],
        },
      },
      {
        plugins: [svelte()],
        resolve: { conditions: ["browser"] },
        test: {
          name: "svelte",
          environment: "happy-dom",
          include: ["test/svelte.test.ts"],
        },
      },
    ],
  },
});
