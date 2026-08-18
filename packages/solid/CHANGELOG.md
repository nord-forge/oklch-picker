# @oklch-picker/solid

## 1.0.0

### Major Changes

- aba8ca4: Framework adapters for Vue, Svelte, Solid, and no framework at all, published as
  scoped packages so an app installs only the adapter it uses.

  - `oklch-picker` — a `<oklch-picker>` custom element with no framework
    and no build step, covering plain HTML, HTMX, Alpine, Astro, and any
    server-rendered page. Form-associated, so it submits under its `name` like a
    built-in input, and its `change` event is typed for `event.detail.colour`.
  - `@oklch-picker/vue` (`v-model`), `@oklch-picker/svelte` (`bind:value`, Svelte 5
    runes), and `@oklch-picker/solid`, each on the same headless model and
    stylesheet as the React component.
  - `@oklch-picker/core` — the colour maths, headless model, and stylesheet, now
    installable on its own for server-side colour work. Ships a minified
    `styles.min.css` (1.3 kB gzipped against 2.3 kB) for the no-build path.

  **Breaking: `oklch-picker` is now the no-framework build.** It was the React
  component; it is now the `<oklch-picker>` custom element, so that `npm i
oklch-picker` gives the version that works anywhere. React users move to
  `@oklch-picker/react`:

  | Was                       | Now                             |
  | ------------------------- | ------------------------------- |
  | `oklch-picker`            | `@oklch-picker/react`           |
  | `oklch-picker/vue`        | `@oklch-picker/vue`             |
  | `oklch-picker/svelte`     | `@oklch-picker/svelte`          |
  | `oklch-picker/solid`      | `@oklch-picker/solid`           |
  | `oklch-picker/vanilla`    | `oklch-picker`                  |
  | `oklch-picker/colour`     | `@oklch-picker/core`            |
  | `oklch-picker/styles.css` | `@oklch-picker/core/styles.css` |

### Patch Changes

- Updated dependencies [aba8ca4]
  - @oklch-picker/core@1.0.0
