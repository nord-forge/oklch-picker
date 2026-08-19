import { defineConfig } from "astro/config";

// The site is served from a project path on GitHub Pages today
// (nord-forge.github.io/oklch-picker) and from a domain root later. Both are
// set here from the environment rather than hard-coded, so the move is a
// change to the workflow, not to the source.
//
// Locally both are unset: dev and `astro preview` run at the root, which is
// also what makes a wrongly hard-coded absolute URL invisible until it is
// deployed. Never write a leading-slash path by hand. Use
// `import.meta.env.BASE_URL` for links and import assets so Vite rewrites them.
// `configure-pages` reports base_path as "" for a domain root and "/my-repo"
// for a project path, so an empty string is meaningful input, not a missing
// one, and `??` alone would pass "" through to Astro. That is the custom-domain
// case, so it has to be right before the move rather than discovered during it.
const site = process.env.SITE_URL || "http://localhost:4321";
const base = process.env.SITE_BASE || "/";

export default defineConfig({
  site,
  base,
  // A trailing slash on every directory URL, so a relative link resolves the
  // same in dev as on Pages. Pages redirects `/docs/install` to
  // `/docs/install/` anyway, and matching it here avoids the redirect.
  trailingSlash: "always",
  build: { format: "directory" },
  // Both themes, so highlighted code follows the page rather than pinning one
  // scheme. Shiki emits CSS variables for the dark set, which the stylesheet
  // switches on `prefers-color-scheme` and on the `data-theme` override.
  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
    },
  },

  // The packages are linked by `file:` path, so their dist lives outside this
  // root. Same allowance the Astro example needs.
  vite: { server: { fs: { allow: [".", ".."] } } },
});
