/**
 * The reader's chosen framework, shared by every tab set and remembered
 * between pages.
 *
 * Someone reading the docs uses one framework. Making them re-pick it in every
 * code block, and again on the next page, is the kind of friction that is
 * invisible to whoever built it and constant for whoever reads it.
 */
export const FRAMEWORKS = [
  "React",
  "Vue",
  "Svelte",
  "Solid",
  "Angular",
  "Qwik",
  // Astro has no adapter: it renders the custom element, exactly as any
  // server-rendered page does. It is listed anyway because someone reaching
  // for an Astro colour picker looks for Astro, not for "no framework", and a
  // tab that says so is quicker than a paragraph explaining the equivalence.
  "Astro",
  "No framework",
] as const;

export type Framework = (typeof FRAMEWORKS)[number];

export const STORAGE_KEY = "okp-framework";

/** Slug used for `data-` attributes and radio values. */
export function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

/** A tab set may offer a subset (some examples are HTML-only), so a stored
 *  choice that a given set cannot honour falls back to that set's first tab
 *  rather than leaving it with nothing selected. */
export function resolve(stored: string | null, available: readonly string[]): string | undefined {
  if (stored && available.includes(stored)) return stored;
  return available[0];
}
