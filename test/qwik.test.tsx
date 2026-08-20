/** The Qwik adapter, rendered through Qwik's own test harness.
 *
 * The `qwik` vitest project runs the optimizer, which is not optional: `$()` is
 * a build-time marker rather than a runtime function, and without the plugin
 * every `component$` throws.
 *
 * Gamuts arrive as ids here, unlike every other adapter. A `Gamut` carries
 * `fromLms`, and Qwik serialises props to resume a component, so the object
 * cannot cross the boundary. See `packages/qwik/src/gamuts.ts`.
 */
import { component$, useSignal } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { parseOklch } from "@oklch-picker/core";
import { ColourPicker, type GamutId } from "@oklch-picker/qwik";
import { describe, expect, test } from "vitest";

interface HostProps {
  initial?: string;
  gamut?: GamutId;
  presets?: string[];
  parts?: Record<string, boolean>;
  layout?: "chart" | "stacked" | "compact" | "side-by-side";
  classPrefix?: string;
}

/** Controlled, like the other adapters' tests: what the picker emits goes
 * straight back in, so a drag that clamps is read back through
 * `resolveCurrent`. The `#out` paragraph is how a test reads that state. */
const Host = component$<HostProps>((p) => {
  const colour = useSignal(p.initial ?? "oklch(0.7 0.15 255)");
  return (
    <>
      <ColourPicker
        value={colour.value}
        gamut={p.gamut}
        presets={p.presets}
        parts={p.parts}
        layout={p.layout}
        classPrefix={p.classPrefix}
        onChange$={(c) => {
          colour.value = c;
        }}
      />
      <p id="out">{colour.value}</p>
    </>
  );
});

async function mount(props: HostProps = {}) {
  const dom = await createDOM();
  await dom.render(<Host {...props} />);
  return {
    ...dom,
    /** What the host is holding, which is what the picker last emitted. */
    state: () => dom.screen.querySelector("#out")?.textContent ?? "",
    sliders: () => [...dom.screen.querySelectorAll("input[type=range]")] as HTMLInputElement[],
  };
}

async function slide(h: Awaited<ReturnType<typeof mount>>, index: number, to: number) {
  const slider = h.sliders()[index];
  if (!slider) throw new Error(`no slider at ${index}`);
  slider.value = String(to);
  await h.userEvent(slider, "input");
}

describe("ColourPicker (Qwik)", () => {
  test("renders one slider per OKLCH axis, plus alpha", async () => {
    const h = await mount();
    expect(h.sliders()).toHaveLength(4);
  });

  test("emits a canonical oklch string when a slider moves", async () => {
    const h = await mount();
    await slide(h, 0, 0.5);
    expect(h.state()).toMatch(/^oklch\(/);
    expect(parseOklch(h.state())?.l).toBeCloseTo(0.5, 2);
  });

  test("never emits a colour outside the gamut", async () => {
    // Dialling far past what sRGB can show comes back with the chroma reduced,
    // keeping lightness and hue.
    const h = await mount({ initial: "oklch(0.75 0.2 145)" });
    await slide(h, 0, 0.15);
    expect(parseOklch(h.state())?.c).toBeLessThan(0.2);
  });

  test("moving one slider keeps what the others were already dragged to", async () => {
    const h = await mount();
    await slide(h, 0, 0.35);
    expect(parseOklch(h.state())?.l).toBeCloseTo(0.35, 2);
    await slide(h, 2, 300);
    expect(parseOklch(h.state())?.l).toBeCloseTo(0.35, 2);
    expect(parseOklch(h.state())?.h).toBeCloseTo(300, 0);
  });

  test("dragging through an unreachable region keeps the other axes", async () => {
    const h = await mount();
    await slide(h, 1, 0.4);
    await slide(h, 2, 300);
    // The hue survives a chroma drag that was clamped on the way.
    expect(parseOklch(h.state())?.h).toBeCloseTo(300, 0);
  });

  test("renders presets and selects one on click", async () => {
    const h = await mount({ presets: ["oklch(0.75 0.16 145)", "oklch(0.5 0.1 30)"] });
    const buttons = h.screen.querySelectorAll(".oklch-picker__preset");
    expect(buttons).toHaveLength(2);
    await h.userEvent(buttons[1] as Element, "click");
    expect(h.state()).toBe("oklch(0.5 0.1 30)");
  });

  test("a gamut id reaches the model where the object could not", async () => {
    // The whole reason this adapter differs. A P3 picker clamps less hard than
    // an sRGB one, which is only true if the id resolved to the real gamut.
    const wide = await mount({ initial: "oklch(0.75 0.25 145)", gamut: "p3" });
    await slide(wide, 0, 0.75);
    const narrow = await mount({ initial: "oklch(0.75 0.25 145)" });
    await slide(narrow, 0, 0.75);
    expect(parseOklch(wide.state())?.c ?? 0).toBeGreaterThan(parseOklch(narrow.state())?.c ?? 0);
  });

  test("parts can be turned off individually", async () => {
    const h = await mount({ parts: { charts: false, name: false, alpha: false } });
    expect(h.screen.querySelector(".oklch-picker__chart")).toBeFalsy();
    expect(h.screen.querySelector(".oklch-picker__name")).toBeFalsy();
    expect(h.sliders()).toHaveLength(3);
  });

  test("the hex field is opt-in, and oklch shows by default", async () => {
    const plain = await mount();
    expect(plain.screen.querySelector(".oklch-picker__field--oklch")).toBeTruthy();
    expect(plain.screen.querySelector(".oklch-picker__field--hex")).toBeFalsy();

    const opted = await mount({ parts: { hexInput: true } });
    expect(opted.screen.querySelector(".oklch-picker__field--hex")).toBeTruthy();
  });

  test("layouts set a modifier class, and compact drops the charts", async () => {
    const compact = await mount({ layout: "compact" });
    expect(compact.screen.querySelector(".oklch-picker--compact")).toBeTruthy();
    expect(compact.screen.querySelector(".oklch-picker__chart")).toBeFalsy();
  });

  test("the chart layout shows one plot, stacked gives each axis its own", async () => {
    const chart = await mount({ layout: "chart" });
    expect(chart.screen.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
    const stacked = await mount({ layout: "stacked" });
    expect(stacked.screen.querySelectorAll(".oklch-picker__chart")).toHaveLength(3);
  });

  test("class prefix is applied so styles can be overridden", async () => {
    const h = await mount({ classPrefix: "brand" });
    expect(h.screen.querySelector(".brand")).toBeTruthy();
    expect(h.screen.querySelector(".oklch-picker")).toBeFalsy();
  });

  test("two pickers do not share a gradient id", async () => {
    // Both in one render. Qwik's harness gives each `createDOM()` its own
    // document, so mounting twice would compare ids that never share a
    // namespace and prove nothing.
    const Two = component$(() => (
      <>
        <ColourPicker value="oklch(0.7 0.15 255)" />
        <ColourPicker value="oklch(0.5 0.1 30)" />
      </>
    ));
    const { screen, render } = await createDOM();
    await render(<Two />);
    // By attribute, not element name: the harness's querySelectorAll does not
    // match the camel-cased SVG tag.
    const ids = [...screen.querySelectorAll("[id^=oklch-picker-gamut-]")].map((g: Element) =>
      g.getAttribute("id"),
    );
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
