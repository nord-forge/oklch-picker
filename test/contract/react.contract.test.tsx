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
        const r = el.getBoundingClientRect();
        fireEvent.pointerDown(el, {
          pointerId: 1,
          clientX: r.left + x * r.width,
          clientY: r.bottom - y * r.height,
        });
        fireEvent.pointerUp(el, { pointerId: 1 });
      },
      blur: (el) => {
        fireEvent.blur(el);
      },
    };
  },
});

test("the one build renders under Preact's compat alias", () => {
  const { container } = render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />);
  expect(container.querySelectorAll("input[type=range]").length).toBeGreaterThan(0);
  cleanup();
});
