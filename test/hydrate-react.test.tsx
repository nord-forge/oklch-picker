/** Server markup, hydrated for real.
 *
 * The determinism tests prove the model is a pure function, which is what
 * hydration depends on. This proves the conclusion rather than the premise:
 * render on a server, put that HTML in a document, hydrate over it, and fail if
 * the framework complains or throws the markup away.
 *
 * A mismatch is otherwise silent. The framework discards the server render and
 * paints again, costing exactly the flash that server rendering was meant to
 * avoid, with nothing a user would notice.
 */
import { ColourPicker } from "@oklch-picker/react";
import { hydrate } from "preact";
import { render as renderToString } from "preact-render-to-string";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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

/** Server-render, drop it in a document, then hydrate over it.
 *
 * `html` can rewrite the server output, which is how the falsification test
 * below feeds hydration markup that is wrong on purpose. */
function hydrateOver(node: preact.ComponentChild, html: (out: string) => string = (out) => out) {
  const host = document.createElement("div");
  host.innerHTML = html(renderToString(node as never));
  document.body.append(host);
  const before = host.innerHTML;
  hydrate(node as never, host);
  return { host, before, after: host.innerHTML };
}

/** Every range slider's live value.
 *
 * Read as properties, not `innerHTML`. Preact hydrates a control by assigning
 * its property and leaves the server's attribute in place, so comparing
 * serialised HTML across the call reports no change even when the value it
 * hydrated over was wrong. */
const sliders = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLInputElement>("input[type=range]")].map((el) => el.value);

test("hydrating the default picker keeps the server markup", () => {
  const { before, after, host } = hydrateOver(
    <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />,
  );
  expect(warnings).toEqual([]);
  // Same DOM after hydration as the server sent: nothing was thrown away.
  expect(after).toBe(before);
  expect(sliders(host)).toEqual(["0.7", "0.15", "255", "1"]);
});

test("a wrong server value survives hydration, so the render has to be right", () => {
  // Preact trusts the server's markup: it does not warn on a value mismatch,
  // does not repair it, and `after === before` holds either way. So none of the
  // assertions above can catch a bad server render, and this records why.
  //
  // The guarantee comes from elsewhere instead. `pickerModel()` is pure, and
  // `ssr-hydration.test.ts` pins the server and client to the same output.
  // Vue and Svelte do detect this, and they cover the shared model.
  const { host, before, after } = hydrateOver(
    <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />,
    (out) => out.replace(/value="0\.7"/, 'value="0.123"'),
  );
  expect(warnings).toEqual([]);
  expect(after).toBe(before);
  expect(sliders(host)[0]).toBe("0.123");
});

test("the hydrated picker is live, not just markup", () => {
  const seen: string[] = [];
  const { host } = hydrateOver(
    <ColourPicker value="oklch(0.7 0.15 255)" onChange={(c) => seen.push(c)} />,
  );
  const hue = host.querySelector<HTMLInputElement>('input[aria-label="Hue"]');
  if (!hue) throw new Error("no hue slider after hydration");
  hue.value = "120";
  hue.dispatchEvent(new Event("input", { bubbles: true }));
  // Hydration attached the handlers; a discarded render would have too, but a
  // silently inert one would not.
  expect(seen.at(-1)).toMatch(/^oklch\(/);
});

test("a transparent colour hydrates without complaint", () => {
  const { before, after } = hydrateOver(
    <ColourPicker value="oklch(0.7 0.15 255 / 0.4)" onChange={() => {}} />,
  );
  expect(warnings).toEqual([]);
  expect(after).toBe(before);
});

test("two pickers hydrate together, keeping their own gradient ids", () => {
  const { host, before, after } = hydrateOver(
    <div>
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />
      <ColourPicker value="oklch(0.5 0.1 30)" onChange={() => {}} />
    </div>,
  );
  expect(warnings).toEqual([]);
  expect(after).toBe(before);
  const ids = [...host.querySelectorAll("linearGradient")].map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
});
