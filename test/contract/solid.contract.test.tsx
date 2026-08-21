import type { Gamut } from "@oklch-picker/core";
import { ColourPicker } from "@oklch-picker/solid";
/** Solid against the shared contract, plus what only Solid does. */
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { expect, test } from "vitest";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

/** Stub the box the adapter measures and the pointer capture it takes, since
 * happy-dom lays nothing out and a pick would divide by zero. */
function layOut(el: Element): void {
  const svg = el as SVGSVGElement;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
  svg.setPointerCapture = () => {};
  svg.hasPointerCapture = () => true;
}

adapterContract({
  name: "Solid",
  /** Solid's JSX types model neither `focusable` nor an `attr:` escape that
   * typechecks, so the chart cannot carry it. Nothing is lost: it is an IE11
   * attribute, the chart holds no focusable child, and `aria-hidden` already
   * keeps it out of the accessibility tree. */
  unsupported: {
    "the chart carries the legacy focusable opt-out":
      "Solid's JSX types have no `focusable` attribute and no `attr:` escape that typechecks",
  },
  cleanup,
  mount(props: PickerProps): Mounted {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];
    // Controlled through a signal, which is how a Solid app drives it: the
    // emitted value goes back in, so a clamped one is read back through
    // `resolveCurrent`.
    const [colour, setColour] = createSignal(props.value);

    const view = render(() => (
      <ColourPicker
        {...props}
        value={colour()}
        onChange={(c) => {
          emitted.push(c);
          setColour(c);
        }}
        onRecentsChange={(r) => recents.push(r)}
        onGamutChange={(g) => gamuts.push(g)}
      />
    ));

    return {
      root: view.container as HTMLElement,
      emitted,
      recents,
      gamuts,
      set: (el, value) => {
        fireEvent.input(el, { target: { value } });
      },
      click: (el) => {
        fireEvent.click(el);
      },
      drag: (el, x, y) => {
        layOut(el);
        fireEvent.pointerDown(el, { pointerId: 1, clientX: x * 200, clientY: 100 - y * 100 });
        fireEvent.pointerUp(el, { pointerId: 1 });
      },
      blur: (el) => {
        fireEvent.blur(el);
      },
      release: (el) => {
        fireEvent.pointerUp(el, { pointerId: 1 });
      },
    };
  },
});

test("the value is read at the call site, so a signal drives it", () => {
  const [colour, setColour] = createSignal("oklch(0.7 0.15 255)");
  const view = render(() => <ColourPicker value={colour()} onChange={setColour} />);
  fireEvent.input(view.container.querySelector('input[aria-label="Hue"]') as Element, {
    target: { value: "120" },
  });
  expect(colour()).toMatch(/^oklch\(/);
  cleanup();
});

// Regression: every chart built its id from the class prefix and the axis, so
// two pickers on a page both emitted `oklch-picker-gamut-h` and the second
// chart filled from the first one's gradient. Solid's `createUniqueId` counts
// per module rather than per root, so even separate renders stay distinct.
test("two pickers do not collide", () => {
  const a = render(() => <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />);
  const b = render(() => <ColourPicker value="oklch(0.5 0.1 30)" onChange={() => {}} />);
  const ids = [a, b].flatMap((r) =>
    Array.from(r.container.querySelectorAll("linearGradient")).map((g) => g.id),
  );
  expect(ids.length).toBeGreaterThan(1);
  expect(new Set(ids).size).toBe(ids.length);
});
