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
/* Two projects render the markup that two others hydrate over.
 *
 * Svelte and Solid each compile twice, and the two compilations cannot share a
 * vitest project: the server build needs server resolve conditions, the client
 * needs `browser`, and a project resolves one of them. So `ssr-svelte` and
 * `ssr-solid` write their markup to a file and the `svelte` and `solid`
 * projects read it back.
 *
 * `groupOrder` is what makes that safe. Projects run in parallel by default,
 * so the readers would race the writers and fail on a missing file. Group 0
 * renders, group 1 consumes. The fixtures also carry a hash of the sources they
 * came from, so a stale one fails loudly rather than testing old markup. */
export default defineConfig({
  test: {
    projects: [
      {
        // The React-API build, rendered with Preact via the compat alias.
        // That proves the single build genuinely works there.
        test: {
          name: "react",
          environment: "happy-dom",
          include: [
            "test/{ColourPicker,GamutChart}.test.tsx",
            "test/colour.test.ts",
            "test/hydrate-react.test.tsx",
          ],
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
        /* Angular compiles its templates at runtime here (JIT), which is what
         * `@angular/compiler` and the dynamic platform are for. The published
         * package ships decorators rather than precompiled `ɵcmp` output, so
         * this is also the check that a consumer's own compiler can read it. */
        test: {
          name: "angular",
          environment: "happy-dom",
          include: ["test/angular.test.ts"],
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
        // No DOM at all: this is what a server looks like, and the point is to
        // fail on a `document` reference rather than find a happy-dom global.
        test: {
          name: "ssr",
          environment: "node",
          include: ["test/ssr.test.ts", "test/ssr-hydration.test.ts"],
        },
      },
      {
        plugins: [vue()],
        test: {
          name: "vue",
          environment: "happy-dom",
          include: ["test/vue.test.ts", "test/hydrate-vue.test.ts"],
        },
      },
      {
        plugins: [solid()],
        resolve: { conditions: ["development", "browser"] },
        test: {
          name: "solid",
          sequence: { groupOrder: 1 },
          environment: "happy-dom",
          include: ["test/solid.test.tsx", "test/hydrate-solid.test.tsx"],
        },
      },
      {
        plugins: [svelte()],
        resolve: { conditions: ["browser"] },
        test: {
          name: "svelte",
          sequence: { groupOrder: 1 },
          environment: "happy-dom",
          include: ["test/svelte.test.ts", "test/hydrate-svelte.test.ts"],
        },
      },

      /* Server rendering, one project per framework.
       *
       * Each needs its framework's plugin to compile the adapter, but the node
       * environment rather than happy-dom: the point is that a stray
       * `document` fails instead of quietly finding a global. Svelte and Solid
       * also need their server resolve conditions, since asking for `browser`
       * would hand back the client build and prove nothing. */
      {
        plugins: [vue()],
        test: {
          name: "ssr-vue",
          environment: "node",
          include: ["test/ssr-vue.test.ts", "test/ssr-ids.test.ts"],
        },
      },
      {
        plugins: [svelte()],
        test: {
          name: "ssr-svelte",
          sequence: { groupOrder: 0 },
          environment: "node",
          include: ["test/ssr-svelte.test.ts"],
        },
      },
      {
        plugins: [solid({ ssr: true })],
        resolve: { conditions: ["development", "node"] },
        test: {
          name: "ssr-solid",
          sequence: { groupOrder: 0 },
          environment: "node",
          include: ["test/ssr-solid-fixture.test.tsx", "test/ssr-solid.test.tsx"],
        },
      },
      {
        // Preact stands in for React here as it does everywhere else, so the
        // one build is proven to render on a server under that API too.
        oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
        resolve: {
          alias: {
            react: "preact/compat",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime",
          },
        },
        test: {
          name: "ssr-react",
          environment: "node",
          include: ["test/ssr-react.test.tsx"],
        },
      },
    ],
  },
});
