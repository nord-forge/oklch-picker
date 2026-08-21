/** React against the shared contract, plus what only React does. */
import type { Gamut } from "@oklch-picker/core";
import { cleanup, fireEvent, render } from "@testing-library/preact";
import { expect, test } from "vitest";
import { ColourPicker } from "../../packages/react/src/ColourPicker.js";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

adapterContract({
  name: "React",
  cleanup,
  mount(props: PickerProps): Mounted {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];
    // Controlled, so a clamped emit is read back through `resolveCurrent` the
    // way a real app would drive it.
    let current = props.value;

    const node = () => (
      <ColourPicker
        {...props}
        value={current}
        onChange={(c) => {
          emitted.push(c);
          current = c;
          view.rerender(node());
        }}
        onRecentsChange={(r) => recents.push(r)}
        onGamutChange={(g) => gamuts.push(g)}
      />
    );
    const view = render(node());

    return {
      root: view.container as HTMLElement,
      emitted,
      recents,
      gamuts,
      // React fires `change`, Preact `input`. The adapter binds both, so
      // firing `input` covers either.
      set: (el, value) => {
        fireEvent.input(el, { target: { value } });
      },
      click: (el) => {
        fireEvent.click(el);
      },
      drag: (el, x, y) => {
        // happy-dom lays nothing out, so the chart has no size and a pick
        // would divide by zero. Stub the box the adapter measures, and the
        // pointer capture it takes to keep a drag alive off-element.
        const svg = el as SVGSVGElement;
        svg.getBoundingClientRect = () =>
          ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
        svg.setPointerCapture = () => {};
        svg.hasPointerCapture = () => true;
        fireEvent.pointerDown(el, { pointerId: 1, clientX: x * 200, clientY: 100 - y * 100 });
        fireEvent.pointerUp(el, { pointerId: 1 });
      },
      blur: (el) => {
        fireEvent.blur(el);
      },
      release: (el) => {
        fireEvent.pointerUp(el);
      },
    };
  },
});

test("the one build renders under Preact's compat alias", () => {
  const { container } = render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />);
  expect(container.querySelectorAll("input[type=range]").length).toBeGreaterThan(0);
  cleanup();
});

test("the picker is controlled: without the value fed back, it does not move", () => {
  // What the READMEs promise, pinned. Wiring only the callback leaves the
  // sliders stuck while the picker emits against a colour that never changes,
  // which is a silent failure worth a test rather than a footnote.
  const seen: string[] = [];
  const view = render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={(c) => seen.push(c)} />);
  const hue = () => view.container.querySelector('input[aria-label="Hue"]') as HTMLInputElement;
  fireEvent.input(hue(), { target: { value: "300" } });
  expect(seen.at(-1)).toContain("300");
  // Emitted, but not rendered: nothing fed the value back.
  expect(hue().value).toBe("255");
  cleanup();
});
