# Contributing

Thanks for considering it. Issues and pull requests are both welcome. If the
change is substantial, an issue first will save you effort in case it does not
fit the direction.

## Getting set up

```sh
npm install     # workspace root; links the six packages together
npm run build   # required before the examples will resolve anything
npm test        # 113 tests across five vitest projects
npm run dev     # every example at once, ports 5272-5277
```

**Node 22.18 or newer**, because the build tool needs it. The published packages
themselves run on Node 20, which is what their `engines` fields say.

## The shape of the codebase

Six packages under `packages/`: `core` holds the colour maths and the headless
model, and five adapters build on it: `react`, `vue`, `svelte`, `solid`, and
`vanilla` (published as the bare `oklch-picker` name).

**Behaviour belongs in `core`.** An adapter should only contain markup and state
wiring, which is why each is around 250 lines. If you find yourself writing the
same logic in two adapters, it belongs in the model instead so all five get it.

`CLAUDE.md` in the repo root goes into more detail, including the invariants
worth preserving and the constraints that are easy to trip over.

## Before opening a pull request

```sh
npm run lint        # biome; lint:fix to write
npm run typecheck   # tsc, a second pass for Solid, and svelte-check
npm test
```

A behaviour change wants a test. The suites mirror each other deliberately, so
the same assertions run against every adapter. A change to shared behaviour
usually means the same test in five places.

Add a changeset describing the change:

```sh
npm run changeset
```

All six packages share one version number, so pick the bump for the change
itself and every package follows.

## Conventions

- **British spelling** in identifiers and prose: `colour`, `colourName`,
  `ColourPicker`. The `--okp-*` CSS variables are the exception.
- Comments explain *why*, not *what*. Match the density of the code around them.
- Conventional commits, sentence case: `feat: Add a compact layout`.
