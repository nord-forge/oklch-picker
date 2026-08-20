/** Vue's server markup, hydrated for real.
 *
 * Vue warns loudly on a hydration mismatch and then patches the DOM to match
 * the client, so both the warning and the resulting markup are worth asserting.
 */
import { ColourPicker } from "@oklch-picker/vue";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";

let warnings: string[] = [];
let restore: (() => void)[] = [];

beforeEach(() => {
  warnings = [];
  for (const level of ["warn", "error"] as const) {
    const spy = vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    });
    restore.push(() => spy.mockRestore());
  }
});

afterEach(() => {
  for (const undo of restore) undo();
  restore = [];
  document.body.innerHTML = "";
});

const app = (props: Record<string, unknown>) =>
  createSSRApp({ render: () => h(ColourPicker, props) });

async function hydrateOver(props: Record<string, unknown>) {
  const host = document.createElement("div");
  host.innerHTML = await renderToString(app(props));
  document.body.append(host);
  const before = host.innerHTML;
  app(props).mount(host);
  return { host, before, after: host.innerHTML };
}

test("hydrating the default picker keeps the server markup", async () => {
  const { before, after, host } = await hydrateOver({ modelValue: "oklch(0.7 0.15 255)" });
  expect(warnings).toEqual([]);
  expect(after).toBe(before);
  expect(host.querySelectorAll("input[type=range]")).toHaveLength(4);
});

test("a transparent colour hydrates without complaint", async () => {
  const { before, after } = await hydrateOver({ modelValue: "oklch(0.7 0.15 255 / 0.4)" });
  expect(warnings).toEqual([]);
  expect(after).toBe(before);
});
