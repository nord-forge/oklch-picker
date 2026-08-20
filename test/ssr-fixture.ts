/** Where the Svelte server render hands its markup to the hydration test.
 *
 * Svelte and Solid each compile twice, and the two compilations cannot share a
 * vitest project. The server build needs server resolve conditions and the
 * client build needs `browser`, and a project resolves one of them. A single
 * file that renders and then hydrates gets a DOM-compiled component passed to
 * the server renderer, which fails inside the framework rather than in the
 * picker.
 *
 * Solid has the same split for the same reason, and uses the same handoff.
 * React and Vue have no such split and render inline in their own tests.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SSR_FIXTURE = join(tmpdir(), "oklch-picker-ssr-svelte.json");
export const SSR_FIXTURE_SOLID = join(tmpdir(), "oklch-picker-ssr-solid.json");

export interface SsrCase {
  html: string;
  props: Record<string, unknown>;
  /** The lightness slider's value, so the hydration test can tell the server's
   * markup apart from a client-rendered default. */
  lightness: string;
}

export interface SsrFixture {
  default: SsrCase;
  alpha: SsrCase;
  /** Hash of the adapter and core sources the markup was rendered from.
   *
   * A fixture older than the code it came from would hydrate cleanly and prove
   * nothing, the same way a stale `dist/` makes the vanilla tests check the
   * previous build. The reader recomputes this and refuses a mismatch. */
  stamp: string;
}

/** Hash the sources the server render depends on. */
export function sourceStamp(adapter: "svelte" | "solid" = "svelte"): string {
  const files = [
    adapter === "solid"
      ? "packages/solid/src/index.tsx"
      : "packages/svelte/src/ColourPicker.svelte",
    "packages/core/src/model.ts",
    "packages/core/src/colour.ts",
  ];
  const hash = createHash("sha256");
  for (const file of files) hash.update(readFileSync(join(ROOT, file)));
  return hash.digest("hex").slice(0, 16);
}
