/** Svelte hydration over real server markup.
 *
 * The markup is not rendered here. `test/ssr-svelte.test.ts` writes it in the
 * `ssr-svelte` project and this reads it back, because the two compilations
 * cannot share a vitest project: the server render needs Svelte's server
 * resolve conditions and the client needs `browser`, and a project resolves one
 * of them. Asking for both in one file hands `svelte/server` a component
 * compiled for the DOM, which fails inside Svelte rather than in the picker.
 *
 * Assertions read DOM *properties*, never `innerHTML`. Svelte hydrates a
 * control by assigning its property and leaves the server's attribute alone, so
 * comparing serialised HTML across the call reports no change even when
 * hydration has just corrected the value. That comparison passes on markup it
 * should reject, which is worse than no test.
 */
import { readFileSync } from "node:fs";
import { ColourPicker } from "@oklch-picker/svelte";
import { hydrate } from "svelte";
import { expect, test } from "vitest";
import { SSR_FIXTURE, type SsrFixture, sourceStamp } from "./ssr-fixture";

const fixture: SsrFixture = JSON.parse(readFileSync(SSR_FIXTURE, "utf8"));

if (fixture.stamp !== sourceStamp()) {
  throw new Error(
    "The server markup is older than the source it came from. Run the ssr-svelte project first: npm test, or npx vitest run --project ssr-svelte",
  );
}

function hydrateOver(html: string, props: Record<string, unknown>) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  hydrate(ColourPicker, { target: host, props });
  return host;
}

const sliders = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLInputElement>("input[type=range]")].map((el) => el.value);

test("hydrating the server markup adopts it rather than rebuilding", () => {
  const host = hydrateOver(fixture.default.html, fixture.default.props);
  // The node identity is the point: a discarded render would replace it.
  const slider = host.querySelector("input[type=range]");
  expect(slider).not.toBeNull();
  expect(slider?.isConnected).toBe(true);
  expect(sliders(host)[0]).toBe(fixture.default.lightness);
});

test("hydration corrects a slider the server got wrong", () => {
  // Proves the assertions above can fail. Svelte writes the property and
  // leaves the stale attribute, so only the property shows the repair.
  const wrong = fixture.default.html.replace(
    `value="${fixture.default.lightness}"`,
    'value="0.123"',
  );
  const host = hydrateOver(wrong, fixture.default.props);
  const slider = host.querySelector<HTMLInputElement>("input[type=range]");
  expect(slider?.getAttribute("value")).toBe("0.123");
  expect(slider?.value).toBe(fixture.default.lightness);
});

test("a transparent colour hydrates with its alpha intact", () => {
  const host = hydrateOver(fixture.alpha.html, fixture.alpha.props);
  // Four sliders with alpha on, and the fourth carries the 0.4.
  expect(sliders(host)).toHaveLength(4);
  expect(sliders(host)[3]).toBe("0.4");
});
