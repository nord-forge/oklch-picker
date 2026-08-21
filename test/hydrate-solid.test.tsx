/** Solid's server markup, checked against what the client builds.
 *
 * Not a real `hydrate()` call, unlike the React, Vue and Svelte suites. Solid
 * matches server nodes by `data-hk` keys, and `renderToString` reserves key "0"
 * for a root wrapper that only exists in a real page, where
 * `generateHydrationScript()` has run in the document head. Rebuilding that
 * outside a browser means hand-forging `globalThis._$HY` and guessing at the
 * key offset. Every combination that appeared to work turned out to be an
 * artefact: an earlier failed attempt in the same module had already consumed
 * the mismatched root key. A test that passes for that reason is worse than no
 * test.
 *
 * So this asserts the property hydration depends on: the server and the client
 * build the same tree from the same value. A model that rendered differently on
 * the two sides fails here. What is not covered is Solid's own key matching,
 * which is Solid's code rather than the picker's, and `test/ssr-solid.test.tsx`
 * already shows the markup carries the keys.
 *
 * The markup is rendered by the `ssr-solid` project rather than here, since
 * this one compiles the component for the DOM. See `ssr-fixture.ts`.
 */
import { readFileSync } from "node:fs";
import { ColourPicker } from "@oklch-picker/solid";
import { render } from "solid-js/web";
import { afterEach, expect, test } from "vitest";
import { SSR_FIXTURE_SOLID, type SsrFixture, sourceStamp } from "./ssr-fixture";

const fixture: SsrFixture = JSON.parse(readFileSync(SSR_FIXTURE_SOLID, "utf8"));

if (fixture.stamp !== sourceStamp("solid")) {
  throw new Error(
    "The server markup is older than the source it came from. Run the ssr-solid project first: npm test, or npx vitest run --project ssr-solid",
  );
}

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
});

/** The element tree, ignoring the hydration keys and attribute order that
 * differ between the two renderers by design. */
function shape(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  return [...host.querySelectorAll("*")]
    .map((el) => `${el.tagName}.${el.getAttribute("class") ?? ""}`)
    .join("|");
}

function clientRender(value: string): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  disposers.push(render(() => <ColourPicker value={value} onChange={() => {}} />, host));
  return host;
}

const sliders = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLInputElement>("input[type=range]")].map((el) => el.value);

test("the server and the client build the same tree", () => {
  const host = clientRender(fixture.default.props.value as string);
  expect(shape(host.innerHTML)).toBe(shape(fixture.default.html));
});

test("the server's sliders carry the same values the client computes", () => {
  const host = clientRender(fixture.default.props.value as string);
  expect(sliders(host)[0]).toBe(fixture.default.lightness);
});

test("a transparent colour matches on both sides", () => {
  const host = clientRender(fixture.alpha.props.value as string);
  expect(shape(host.innerHTML)).toBe(shape(fixture.alpha.html));
  expect(sliders(host)).toHaveLength(4);
  expect(sliders(host)[3]).toBe("0.4");
});
