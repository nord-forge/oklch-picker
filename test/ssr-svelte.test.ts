/** Svelte renders the picker on a server, with no DOM in sight. */
import { writeFileSync } from "node:fs";
import { ColourPicker } from "@oklch-picker/svelte";
import { render } from "svelte/server";
import { expect, test } from "vitest";
import { SSR_FIXTURE, type SsrCase, type SsrFixture, sourceStamp } from "./ssr-fixture";

const html = (props: Record<string, unknown> = {}) =>
  render(ColourPicker, { props: { value: "oklch(0.7 0.15 255)", ...props } }).body;

test("there is no DOM to fall back on", () => {
  expect(typeof document).toBe("undefined");
});

test("the server sends real markup, not an empty shell", () => {
  const out = html();
  expect(out.match(/type="range"/g)).toHaveLength(4);
  expect(out).toContain("oklch-picker__chart");
  expect(out).toContain("oklch-picker__alpha");
});

test("the value arrives in the markup rather than after hydration", () => {
  expect(html()).toContain("oklch(0.7 0.15 255)");
});

test("parts still apply on the server", () => {
  const out = html({ parts: { charts: false, alpha: false } });
  expect(out).not.toContain("oklch-picker__chart");
  expect(out.match(/type="range"/g)).toHaveLength(3);
});

test("two renders of the same colour are byte-identical", () => {
  expect(html()).toBe(html());
});

/** Hand this render to the hydration test.
 *
 * It runs in the `svelte` project, which resolves the client build and so
 * cannot call `render` itself. See `ssr-fixture.ts` for why the two cannot
 * share a project. */
test("the markup is published for the hydration test", () => {
  const build = (props: Record<string, unknown>): SsrCase => {
    const body = render(ColourPicker, { props }).body;
    const lightness = body.match(/type="range"[^>]*value="([^"]*)"/)?.[1];
    if (lightness === undefined) throw new Error("no slider in the server markup");
    return { html: body, props, lightness };
  };

  const fixture: SsrFixture = {
    default: build({ value: "oklch(0.7 0.15 255)" }),
    alpha: build({ value: "oklch(0.7 0.15 255 / 0.4)" }),
    stamp: sourceStamp(),
  };
  writeFileSync(SSR_FIXTURE, JSON.stringify(fixture));

  expect(fixture.default.html).not.toBe(fixture.alpha.html);
});
