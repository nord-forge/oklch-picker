/** Svelte against the shared contract, plus what only Svelte does. */
import type { Gamut } from "@oklch-picker/core";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { expect, test } from "vitest";
import ColourPicker from "../../packages/svelte/src/ColourPicker.svelte";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

/** Stub the box the adapter measures and the pointer capture it takes, since
 * happy-dom lays nothing out and a pick would divide by zero. */
function layOut(el: Element): SVGSVGElement {
  const svg = el as SVGSVGElement;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
  svg.setPointerCapture = () => {};
  svg.hasPointerCapture = () => true;
  return svg;
}

adapterContract({
  name: "Svelte",
  cleanup,
  mount(props: PickerProps): Mounted {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];

    const view = render(ColourPicker, {
      props: {
        ...props,
        // Controlled: what the picker emits goes straight back in, so a clamped
        // value is read back through `resolveCurrent`.
        onchange: (c: string) => {
          emitted.push(c);
          view.rerender({ ...props, value: c });
        },
        onrecentschange: (r: string[]) => recents.push(r),
        ongamutchange: (g: Gamut) => gamuts.push(g),
      },
    });

    return {
      root: view.container as HTMLElement,
      emitted,
      recents,
      gamuts,
      set: (el, value) => fireEvent.input(el, { target: { value } }).then(() => undefined),
      click: (el) => fireEvent.click(el).then(() => undefined),
      drag: (el, x, y) => {
        layOut(el);
        return fireEvent
          .pointerDown(el, { pointerId: 1, clientX: x * 200, clientY: 100 - y * 100 })
          .then(() => fireEvent.pointerUp(el, { pointerId: 1 }))
          .then(() => undefined);
      },
      blur: (el) => fireEvent.blur(el).then(() => undefined),
      release: (el) => fireEvent.pointerUp(el, { pointerId: 1 }).then(() => undefined),
    };
  },
});

test("only `value` is bindable; the rest are callbacks", async () => {
  const seen: string[] = [];
  render(ColourPicker, {
    props: { value: "oklch(0.7 0.15 255)", onchange: (c: string) => seen.push(c) },
  });
  await fireEvent.input(document.querySelector('input[aria-label="Hue"]') as Element, {
    target: { value: "120" },
  });
  expect(seen.at(-1)).toMatch(/^oklch\(/);
  cleanup();
});
