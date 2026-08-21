/** The React-API build renders on a server, proven through Preact's renderer
 * as everywhere else in this suite. */
import { ColourPicker } from "@oklch-picker/react";
import { render } from "preact-render-to-string";
import { expect, test } from "vitest";

const html = (props: Record<string, unknown> = {}) =>
  render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} {...props} />);

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

// The same input has to produce the same output twice, or hydration diffs
// against markup the client would never have generated.
test("two renders of the same colour are byte-identical", () => {
  expect(html()).toBe(html());
});
