/**
 * The sitemap, built from the pages that exist rather than from a list to keep
 * in sync.
 *
 * `@astrojs/sitemap` would do this too, and is not worth a dependency for one
 * file: `import.meta.glob` already knows every route at build time, so a page
 * added tomorrow appears here without anyone remembering to add it.
 */
import type { APIRoute } from "astro";
import { FRAMEWORKS } from "../lib/examples";

/** Every routable page. `eager: false` because only the keys are wanted. */
const PAGES = import.meta.glob("./**/*.astro");

/** Pages that should not be indexed, by route. */
const EXCLUDE = new Set(["/404/"]);

function routes(): string[] {
  const out = new Set<string>();
  for (const file of Object.keys(PAGES)) {
    const path = file
      .replace(/^\.\//, "")
      .replace(/\.astro$/, "")
      .replace(/(^|\/)index$/, "");
    // A dynamic segment is not a page; its own `getStaticPaths` decides what is.
    if (path.includes("[")) continue;
    out.add(path ? `/${path}/` : "/");
  }
  // The examples route is dynamic, so its pages are enumerated from the same
  // list that generates them.
  for (const f of FRAMEWORKS) out.add(`/examples/${f.id}/`);
  return [...out].filter((r) => !EXCLUDE.has(r)).sort();
}

export const GET: APIRoute = ({ site }) => {
  // `site` is the deployed origin. Without it every URL here would be relative,
  // which a sitemap may not contain.
  if (!site) throw new Error("`site` must be set in astro.config for the sitemap");

  const base = import.meta.env.BASE_URL;
  const url = (route: string) => new URL(`${base}${route}`.replace(/\/{2,}/g, "/"), site).href;

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes()
  .map((r) => `  <url><loc>${url(r)}</loc></url>`)
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
