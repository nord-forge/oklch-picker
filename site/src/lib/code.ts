/**
 * The light/dark pair every highlighted block uses.
 *
 * Shiki needs the keys named `light` and `dark` — an array throws, and a single
 * theme renders one scheme's colours onto whichever page the visitor is
 * actually looking at. With both, it emits `--shiki-dark-*` custom properties
 * that `site.css` switches on the colour scheme.
 */
export const THEMES = { light: "github-light", dark: "github-dark" } as const;
