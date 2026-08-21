/** Two pickers on one page must not share an SVG gradient id.
 *
 * Regression: every chart built its id from the class prefix and the axis, so
 * both emitted `oklch-picker-gamut-h`. SVG ids share one document-wide
 * namespace, so the second picker's `fill="url(#...)"` resolved to the first
 * one's gradient and its chart took the wrong colours.
 */
import { ColourPicker } from "@oklch-picker/vue";
import { expect, test } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

const gradientIds = (html: string) =>
  [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);

test("two pickers in one tree get different gradient ids", async () => {
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h("div", [
          h(ColourPicker, { modelValue: "oklch(0.7 0.15 255)" }),
          h(ColourPicker, { modelValue: "oklch(0.5 0.1 30)" }),
        ]),
    }),
  );
  const ids = gradientIds(html);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
});

test("every url(#id) reference resolves to an id in the same markup", async () => {
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h("div", [
          h(ColourPicker, { modelValue: "oklch(0.7 0.15 255)" }),
          h(ColourPicker, { modelValue: "oklch(0.5 0.1 30)" }),
        ]),
    }),
  );
  const defined = new Set(gradientIds(html));
  const referenced = [...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  expect(referenced.length).toBeGreaterThan(0);
  for (const ref of referenced) expect(defined.has(ref as string)).toBe(true);
});

test("the ids stay url-safe, since they sit inside url(#...)", async () => {
  const html = await renderToString(
    createSSRApp({ render: () => h(ColourPicker, { modelValue: "oklch(0.7 0.15 255)" }) }),
  );
  for (const id of gradientIds(html)) expect(id).toMatch(/^[A-Za-z0-9_:.-]+$/);
});
