/** Qwik renders the picker on a server, with no DOM in sight.
 *
 * More load-bearing here than for the other adapters. Qwik's whole design is
 * that the server sends finished markup and the client resumes it rather than
 * re-running components, so a picker that needed a browser to draw itself would
 * defeat the framework it was written for.
 *
 * `renderToString` also serialises the component's state into the markup, which
 * is where a non-serialisable prop fails. A `Gamut` object would fail here,
 * which is why this adapter takes ids.
 */
import { component$ } from "@builder.io/qwik";
import { renderToString } from "@builder.io/qwik/server";
import { ColourPicker } from "@oklch-picker/qwik";
import { expect, test } from "vitest";

/** Every QRL resolved to a stub chunk.
 *
 * `renderToString` serialises each event handler as "chunk#symbol" so the
 * client can fetch it lazily, and without a production build there is no
 * manifest saying which chunk holds what. A real app gets that from
 * `qwik build`. The markup is what is under test here, not the chunking, so
 * the mapper hands back a placeholder path and lets the render finish. */
const symbolMapper = (symbolName: string): [string, string] => [
  symbolName,
  `/stub.js#${symbolName}`,
];

const render = (node: Parameters<typeof renderToString>[0]) =>
  renderToString(node, { containerTagName: "div", symbolMapper }).then((r) => r.html);

test("there is no DOM to fall back on", () => {
  expect(typeof document).toBe("undefined");
});

test("the server sends real markup, not an empty shell", async () => {
  const Host = component$(() => <ColourPicker value="oklch(0.7 0.15 255)" />);
  const html = await render(<Host />);
  expect(html.match(/type="range"/g)).toHaveLength(4);
  expect(html).toContain("oklch-picker__chart");
  expect(html).toContain("oklch-picker__alpha");
});

test("the value arrives in the markup rather than after hydration", async () => {
  const Host = component$(() => <ColourPicker value="oklch(0.7 0.15 255)" />);
  expect(await render(<Host />)).toContain("oklch(0.7 0.15 255)");
});

test("parts still apply on the server", async () => {
  const Host = component$(() => (
    <ColourPicker value="oklch(0.7 0.15 255)" parts={{ charts: false, alpha: false }} />
  ));
  const html = await render(<Host />);
  expect(html).not.toContain("oklch-picker__chart");
  expect(html.match(/type="range"/g)).toHaveLength(3);
});

test("a gamut id survives serialisation where the object would not", async () => {
  // The reason this adapter takes ids. A `Gamut` carries `fromLms`, and Qwik
  // throws "Value cannot be serialized ... because it's a function" when one
  // reaches a prop. An id is a string, so it serialises and the wider gamut
  // still reaches the model.
  const Host = component$(() => <ColourPicker value="oklch(0.7 0.25 145)" gamut="p3" />);
  const html = await render(<Host />);
  expect(html).toContain('type="range"');
  expect(html).not.toContain("cannot be serialized");
});

test("two renders of the same colour agree on every value", async () => {
  // Not byte-identical: Qwik stamps its own ids for resumption, and those are
  // the framework's rather than the picker's. What has to match is every value
  // the picker computed.
  const Host = component$(() => <ColourPicker value="oklch(0.7 0.15 255)" />);
  const values = (html: string) => html.match(/value="[^"]*"/g);
  expect(values(await render(<Host />))).toEqual(values(await render(<Host />)));
});
