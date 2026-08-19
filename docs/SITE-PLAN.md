# Docs site plan

A static documentation site for oklch-picker: guides, an API reference, and
live pickers on every page that describes one.

## Decisions

| | |
|---|---|
| Framework | Astro 7 (current latest, 7.2.4) |
| Location | `site/` at the repo root, its own npm workspace |
| Hosting | GitHub Pages at `nord-forge.github.io/oklch-picker`, custom domain later |
| Live demos | The `<oklch-picker>` custom element only, no framework islands |
| Scope | All 25 README sections ported; README shrinks to an intro that links out |

### Why Astro, and why 7

`examples/astro` already renders the vanilla element with no integration and no
hydration directive. Astro ships the markup plus one small module that upgrades
it. That is exactly what every demo on the site needs, so the riskiest part of
the build is a pattern this repo has already shipped and CI already checks.

It also means zero framework runtime on the page. A docs site for a colour
picker with no runtime dependencies should not itself boot React to show one.

The site takes **Astro 7.2.4**, the current `latest`. Two things follow:

- **The site builds on Node 24.** Astro 7's own floor is `>=22.12.0`, but the
  site targets 24. It is a leaf that nothing depends on, so it can take the
  current release without asking anything else to follow. `site/package.json`
  declares `"engines": { "node": ">=24.11.0" }`, and the Pages workflow pins
  `node-version: 24`.
- **This is the site's floor only.** The six published packages keep
  `"node": ">=20"`, the workspace root keeps `^22.18.0 || >=24.11.0`, and the
  existing `ci.yml` jobs stay on Node 22. Raising a published `engines` floor
  is a breaking change for consumers and belongs in a major, decided on its own
  terms. It should not be carried in as a side effect of building a docs site.
- **Astro 7 depends on Vite 8**, while the adapter examples are on earlier Vite
  majors through their own framework plugins. `site/` is a separate workspace
  with its own tree, so the two do not have to agree. But npm hoisting can
  still surprise, so phase 1 checks that `examples:build` stays green after the
  site is installed.

`examples/astro` stays on 5.18.2 for now. It exists to prove the element works
in a consumer's Astro app, and pinning it to whatever is newest is a separate
question from what the site is built with. Worth bumping later, on its own.

### Why the vanilla element for every demo

One dependency, no islands, fastest pages. Framework-specific code appears
beside each demo as a static highlighted snippet. The tab switches the code
shown, not the picker. The picker is identical across adapters, so a live React
instance would demonstrate nothing a vanilla one does not.

The per-framework `examples/*` apps stay as they are. They already prove the
adapters in CI via `examples:build`.

## Path handling, the one thing to get right up front

The site starts at a project path (`/oklch-picker/`) and moves to a domain root
later. Every asset URL depends on that. To make the move a one-line change:

- Set `base` from an env var in `astro.config.mjs`, defaulting to `/`.
- Never write a leading-slash URL by hand. Use `import.meta.env.BASE_URL` for
  links, and import assets so Vite rewrites them.
- The CI deploy sets the env var; local dev and previews run at the root.

Getting this wrong is invisible locally and breaks every link in production,
which is why it leads the plan rather than sitting in a step.

## Structure

```
site/
  astro.config.mjs
  package.json
  src/
    layouts/Page.astro          shell: skip link, nav, sidebar, footer, theme
    components/
      Picker.astro              one live <oklch-picker>, props passed through
      CodeTabs.astro            React/Vue/Svelte/Solid/vanilla snippet switcher
      PropsTable.astro          renders the API table from core's .d.mts
    pages/
      index.astro               hero picker, why, install
      docs/
        install.astro
        usage.astro             one section per framework
        layouts.astro           four layouts, each live
        gamuts.astro            sRGB / P3 / Rec2020, switcher, notices
        recents.astro
        styling.astro           custom properties, live theme editing
        parts.astro             hiding parts
        utilities.astro         the colour maths
        accessibility.astro
      playground.astro          every prop as a control, emits copyable code
      api.astro                 generated props + utilities reference
```

## Phases

Each phase leaves the repo green and is worth committing on its own.

### 1. Scaffold and deploy an empty site

Astro workspace, `base` handling, the page shell, and a Pages workflow. Deploy a
placeholder before writing content. Hosting problems surface while there is
nothing to debug but hosting.

- `site/` workspace on `astro@^7.2.4`, `"engines": { "node": ">=24.11.0" }`,
  added to root `workspaces` and to `dev`
- Confirm `npm run examples:build` still passes once Vite 8 is in the tree
- A `.nvmrc` of `24` at the root, so a contributor's shell picks the version
  the site needs without it becoming an `engines` constraint on anything else
- `astro.config.mjs` with `base` from env, `site` set for canonical URLs
- `Page.astro`: nav, sidebar, footer, theme toggle honouring `data-theme`
- `.github/workflows/pages.yml`: `node-version: 24`, build on push to `main`,
  deploy via `actions/deploy-pages`, needs `pages: write` and `id-token: write`.
  A separate workflow from `ci.yml`, which keeps its Node 22 jobs. The site can
  then move to a newer Node whenever it likes without touching what verifies the
  packages.
- Repo setting: Pages source set to GitHub Actions (manual, one-time)

**Done when** a placeholder page is live at the Pages URL with working CSS.

### 2. The live picker component

`Picker.astro` wrapping `<oklch-picker>`, taking layout, presets, parts and
gamut as props, so every later page is a few lines. Includes the value readout
and swatch that `examples/demo.css` already styles.

**Done when** the home page shows a working picker at the deployed URL.

### 3. Port the guides

The 25 README sections become the `docs/` pages above, each with a live picker
demonstrating what it describes rather than only a snippet. `CodeTabs.astro`
carries the per-framework code.

Prose is lifted from the README, not rewritten. It is already good. The work is
splitting, cross-linking, and adding the demos.

**Done when** every README section has a home on the site.

### 4. Playground

Every prop as a control, with the resulting code shown live and copyable, with a
framework switcher. This is the page people link to.

### 5. API reference

`PropsTable.astro` reading the built `.d.mts` so the table cannot drift from the
types. The current hand-maintained README table already has to be updated by
hand on every prop change.

If parsing the declarations proves fiddly, fall back to a hand-written table for
now and revisit; the plan does not depend on it.

### 6. README shrink and cross-links

README becomes an intro: what it is, install, one example, links to the site.
`docs/media/*` screenshots get reused. Add the site URL to each package's
`package.json` `homepage` so npm links to it.

## Risks

- **`base` path.** Covered above. The mitigation is env-driven config plus never
  hand-writing absolute URLs.
- **Site build reads `dist/`.** Like the examples, the site resolves the
  packages by `file:` path, so CI must `npm run build` before building the site
  or it documents the previous build. Same trap already recorded for `vanilla`
  tests and the Solid typecheck.
- **Docs drift.** Phase 5 (generated props) and phase 6 (README stops being a
  second copy) are what keep one source of truth. Worth doing rather than
  leaving the README as a parallel doc.
- **A sixth npm workspace** adds install time to CI. The Pages job can be
  separate from `verify` so it does not slow the existing checks.

## Deliberately not in v1

- Search. Worth adding once there are enough pages to need it.
- Versioned docs. One version is live; revisit at 2.0.
- Framework islands. Revisit only if a demo genuinely cannot be shown with the
  vanilla element.
- Blog or changelog pages. `CHANGELOG.md` is enough for now.
