/**
 * `robots.txt`, generated rather than a static file in `public/`.
 *
 * The `Sitemap:` line has to be an absolute URL, and the origin is only known
 * at build time from `site` in the config. A static file would have to hard-code
 * it, which is exactly what breaks on the move from a project path to a domain.
 */
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("`site` must be set in astro.config for robots.txt");

  const base = import.meta.env.BASE_URL;
  const sitemap = new URL(`${base}/sitemap.xml`.replace(/\/{2,}/g, "/"), site).href;

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemap}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
