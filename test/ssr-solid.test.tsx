/** Solid renders the picker on a server, with no DOM in sight. */
import { ColourPicker } from "@oklch-picker/solid";
import { renderToString } from "solid-js/web";
import { expect, test } from "vitest";

const html = (props: Record<string, unknown> = {}) =>
  renderToString(() => <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} {...props} />);

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
