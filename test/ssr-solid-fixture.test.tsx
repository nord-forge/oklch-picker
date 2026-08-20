/** Renders the markup that `hydrate-solid.test.tsx` hydrates over.
 *
 * Its own file because Solid's hydration keys come from a counter that
 * `renderToString` advances per render. The other server tests in
 * `ssr-solid.test.tsx` each render once, so a fixture written after them starts
 * numbering at "01" and the client, counting from "00", finds nothing to adopt.
 * A file to itself gets the counter from the start.
 */
import { writeFileSync } from "node:fs";
import { ColourPicker } from "@oklch-picker/solid";
import { renderToString } from "solid-js/web";
import { expect, test } from "vitest";
import { SSR_FIXTURE_SOLID, type SsrCase, type SsrFixture, sourceStamp } from "./ssr-fixture";

const build = (value: string): SsrCase => {
  const html = renderToString(() => <ColourPicker value={value} onChange={() => {}} />);
  const lightness = html.match(/type="range"[^>]*value="([^"]*)"/)?.[1];
  if (lightness === undefined) throw new Error("no slider in the server markup");
  return { html, props: { value }, lightness };
};

test("the markup is published for the hydration test", () => {
  // Rendered first, so its keys start at the root.
  const fixture: SsrFixture = {
    default: build("oklch(0.7 0.15 255)"),
    alpha: build("oklch(0.7 0.15 255 / 0.4)"),
    stamp: sourceStamp("solid"),
  };
  writeFileSync(SSR_FIXTURE_SOLID, JSON.stringify(fixture));

  // "01", not "00": renderToString reserves the first id for the root it wraps
  // the component in. The hydration test passes `renderId: "0"` to line its own
  // counter up with that, which is the whole reason this is worth asserting.
  expect(fixture.default.html).toContain('data-hk="01"');
  expect(fixture.default.html).not.toBe(fixture.alpha.html);
});
