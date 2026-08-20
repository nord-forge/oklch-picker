/** Vue renders the picker on a server, with no DOM in sight. */
import { ColourPicker } from "@oklch-picker/vue";
import { expect, test } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

const render = (props: Record<string, unknown> = {}) =>
  renderToString(
    createSSRApp({
      render: () => h(ColourPicker, { modelValue: "oklch(0.7 0.15 255)", ...props }),
    }),
  );

test("there is no DOM to fall back on", () => {
  expect(typeof document).toBe("undefined");
});

test("the server sends real markup, not an empty shell", async () => {
  const html = await render();
  // Three axes plus alpha. A shell would have none of them.
  expect(html.match(/type="range"/g)).toHaveLength(4);
  expect(html).toContain("oklch-picker__chart");
  expect(html).toContain("oklch-picker__alpha");
});

test("the value arrives in the markup rather than after hydration", async () => {
  // A picker that renders blank and fills in on the client flashes on every
  // page load, which is most of the reason to server-render it at all.
  expect(await render()).toContain("oklch(0.7 0.15 255)");
});

test("parts still apply on the server", async () => {
  const html = await render({ parts: { charts: false, alpha: false } });
  expect(html).not.toContain("oklch-picker__chart");
  expect(html.match(/type="range"/g)).toHaveLength(3);
});

test("a wider gamut renders without reaching for a browser", async () => {
  const { P3 } = await import("@oklch-picker/core/gamuts");
  const html = await render({ gamut: P3, modelValue: "oklch(0.7 0.26 145)" });
  expect(html).toContain("oklch-picker__chart");
});
