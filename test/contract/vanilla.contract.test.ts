/** The custom element against the shared contract, driven through real DOM. */
import type { Gamut } from "@oklch-picker/core";
import { type OklchPickerElement, register } from "oklch-picker";
import { beforeAll, expect, test } from "vitest";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

beforeAll(() => register());

const hosts: HTMLElement[] = [];

adapterContract({
  name: "vanilla",
  cleanup() {
    for (const h of hosts.splice(0)) h.remove();
  },
  mount(props: PickerProps): Mounted {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];

    const host = document.createElement("div");
    hosts.push(host);
    const picker = document.createElement("oklch-picker") as OklchPickerElement;
    host.append(picker);
    document.body.append(host);

    // Properties rather than attributes: `parts`, `labels` and the gamuts are
    // objects, and an attribute would stringify them. `value` goes on as an
    // attribute so it arrives the way server-rendered markup would.
    if (props.value !== undefined) picker.setAttribute("value", props.value);
    for (const key of [
      "presets",
      "recents",
      "maxRecents",
      "layout",
      "parts",
      "labels",
      "gamut",
      "references",
      "gamutChoices",
      "classPrefix",
    ] as const) {
      const v = props[key];
      if (v !== undefined) (picker as unknown as Record<string, unknown>)[key] = v;
    }

    picker.addEventListener("change", (e) => {
      emitted.push((e as CustomEvent<{ colour: string }>).detail.colour);
    });
    picker.addEventListener("recentschange", (e) => {
      recents.push((e as CustomEvent<{ recents: string[] }>).detail.recents);
    });
    picker.addEventListener("gamutchange", (e) => {
      gamuts.push((e as CustomEvent<{ gamut: Gamut }>).detail.gamut);
    });

    return {
      root: host,
      emitted,
      recents,
      gamuts,
      set(el, value) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      click(el) {
        (el as HTMLElement).click();
      },
      drag(el, x, y) {
        // happy-dom lays nothing out, so the chart has no size and a pick would
        // divide by zero.
        const svg = el as SVGSVGElement;
        svg.getBoundingClientRect = () =>
          ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
        svg.setPointerCapture = () => {};
        svg.hasPointerCapture = () => true;
        el.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: x * 200,
            clientY: 100 - y * 100,
          }),
        );
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
      },
      blur(el) {
        el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
      },
      release(el) {
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
      },
    };
  },
});

test("the element upgrades from markup alone", () => {
  const host = document.createElement("div");
  host.innerHTML = '<oklch-picker value="oklch(0.7 0.15 255)"></oklch-picker>';
  document.body.append(host);
  expect(host.querySelectorAll("input[type=range]").length).toBeGreaterThan(0);
  host.remove();
});
