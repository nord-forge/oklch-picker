/**
 * Every internal link goes through here.
 *
 * The site is served from `/oklch-picker/` on GitHub Pages and from `/` once it
 * has a domain, so a hand-written `href="/docs/install/"` works locally and
 * 404s in production. The failure is invisible in dev, which is exactly why
 * links are built rather than typed.
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL;
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = path.startsWith("/") ? path : `/${path}`;
  // `trailingSlash: "always"`, so directory URLs end in one. A path with an
  // extension is a file (`/og.png`) and is left alone.
  const slashed =
    right.endsWith("/") || right.split("/").pop()?.includes(".") ? right : `${right}/`;
  return `${left}${slashed}` || "/";
}

/** Whether `path` is the page currently being rendered, for `aria-current`. */
export function isCurrent(pathname: string, path: string): boolean {
  const a = url(path);
  const b = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return a === b;
}
