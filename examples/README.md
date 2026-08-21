# Examples

One small app per adapter, each installing its scoped package from
`packages/*` via `file:`, so they exercise the real `exports` map rather than
reaching into source.

| Example | Package | Entry |
| --- | --- | --- |
| [`vanilla`](./vanilla) | `oklch-picker` | `<oklch-picker>`, no build step at all |
| [`astro`](./astro) | `oklch-picker` | the same element, inside an SSR framework |
| [`react`](./react) | `@oklch-picker/react` | `value` + `onChange` |
| [`vue`](./vue) | `@oklch-picker/vue` | `v-model` |
| [`svelte`](./svelte) | `@oklch-picker/svelte` | `bind:value` |
| [`solid`](./solid) | `@oklch-picker/solid` | `value` + `onChange` |
| [`angular`](./angular) | `@oklch-picker/angular` | `[value]` + `(valueChange)` |
| [`qwik`](./qwik) | `@oklch-picker/qwik` | `value` + `onChange$` |

**`vanilla` and `astro` use the same package.** There is no Astro-specific
adapter: `oklch-picker` is a custom element, so it works in any HTML.
The two examples exist because they cover different ground. `vanilla` is a
single `.html` file with no tooling whatsoever, and `astro` shows the same
element inside a framework that server-renders the surrounding page.

## Running them

From the repo root, to serve them all at once:

```sh
npm run examples:install   # once, and after changing exports
npm run dev
```

Or one at a time, with `npm run dev:vanilla`, `dev:astro`, `dev:react`, and so on.

`angular` and `qwik` each need a note. Angular's has no framework plugin: the
adapter ships `ngc` output with its templates already compiled, and the example's
own component compiles at runtime, so plain Vite is enough and the Angular CLI
stays out of the repo. Qwik's has two entries, `main.tsx` for the build and
`entry.dev.tsx` for the dev server, because the plugin looks for each by name.

`vanilla` needs no install and no dev server at all; `npm run dev:vanilla` just
serves the repo so its relative `../../dist/` paths resolve. Opening
`examples/vanilla/index.html` from disk works too, once `dist/` is built.

Every example resolves each package's `dist/`, not its source, so build the
workspace first (`npm run build` at the repo root, which `npm run dev` does for
you). Edits under `packages/*/src` need a rebuild before they show up.
