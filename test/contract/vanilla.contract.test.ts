/** The custom element against the shared contract, driven through real DOM. */
import type { Gamut } from "@oklch-picker/core";
import { SRGB, inGamut, parseOklch } from "@oklch-picker/core";
import { P3 } from "@oklch-picker/core/gamuts";
import { type OklchPickerElement, register } from "oklch-picker";
import { beforeAll, expect, test } from "vitest";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

beforeAll(() => register());

const hosts: HTMLElement[] = [];

adapterContract({
  name: "vanilla",
  /** The element holds its own colour, unlike the six controlled adapters, so
   * pressing a gamut is its business rather than the app's: it re-clamps and
   * emits. The READMEs say so, and the test below asserts that behaviour
   * directly. Declared here so the contract prints a skip carrying the reason
   * rather than passing over the difference in silence. */
  unsupported: {
    "pressing a gamut reports it without emitting a colour":
      "the element is uncontrolled, so it switches its own output and emits the re-clamped colour",
  },
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

test("the element is not controlled: it holds its own colour", () => {
  // The opposite of the adapters, and the reason the READMEs say so. No
  // listener, nothing fed back, and the slider still moves.
  const host = document.createElement("div");
  host.innerHTML = '<oklch-picker value="oklch(0.7 0.15 255)"></oklch-picker>';
  document.body.append(host);
  const hue = () => host.querySelector('input[aria-label="Hue"]') as HTMLInputElement;
  hue().value = "300";
  hue().dispatchEvent(new Event("input", { bubbles: true }));
  expect(hue().value).toBe("300");
  expect(host.querySelector("oklch-picker")?.getAttribute("value")).toContain("300");
  host.remove();
});

// The other side of the `unsupported` entry above. The six adapters report a
// gamut press and change nothing, because `gamut` is the app's prop. The
// element owns its colour, so it switches its own output space, re-clamps the
// colour into it, and emits the result. Asserted rather than assumed: the
// contract skips this behaviour for vanilla, so without this test the
// divergence would be documented and unverified.
test("the element switches its own gamut and emits the re-clamped colour", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const el = document.createElement("oklch-picker") as OklchPickerElement;
  // A colour P3 can show and sRGB cannot, so switching down has to move it.
  el.setAttribute("value", "oklch(0.75 0.25 145)");
  el.gamut = P3;
  el.gamutChoices = [SRGB, P3];
  el.parts = { gamutSwitch: true };
  host.append(el);

  const emitted: string[] = [];
  el.addEventListener("change", (e) => emitted.push((e as CustomEvent).detail.colour));

  const choices = el.querySelectorAll<HTMLButtonElement>(".oklch-picker__gamut-choice");
  expect(choices.length).toBe(2);
  // Press sRGB, the narrower of the two.
  choices[0]?.click();

  expect(el.gamut?.id).toBe("srgb");
  expect(emitted.length).toBeGreaterThan(0);
  const last = parseOklch(emitted.at(-1) ?? "");
  expect(last).not.toBeNull();
  expect(inGamut(last as never, SRGB)).toBe(true);
  host.remove();
});
