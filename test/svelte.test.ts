/** The Svelte adapter, asserting the same behaviour as the React suite. */
import { SRGB, parseOklch } from "@oklch-picker/core";
import { P3 } from "@oklch-picker/core/gamuts";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, test, vi } from "vitest";
import ColourPicker from "../packages/svelte/src/ColourPicker.svelte";

afterEach(cleanup);

describe("ColourPicker (Svelte)", () => {
  test("renders one slider per OKLCH axis", () => {
    render(ColourPicker, { props: { value: "oklch(0.7 0.15 255)" } });
    expect(screen.getByLabelText("Lightness")).toBeDefined();
    expect(screen.getByLabelText("Chroma")).toBeDefined();
    expect(screen.getByLabelText("Hue")).toBeDefined();
  });

  test("emits a canonical oklch string when a slider moves", async () => {
    const onchange = vi.fn();
    render(ColourPicker, { props: { value: "oklch(0.7 0.15 255)", onchange } });

    await fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "120" } });

    expect(onchange).toHaveBeenCalled();
    expect(parseOklch(onchange.mock.calls[0]?.[0] as string)?.h).toBeCloseTo(120, 0);
  });

  test("never emits a colour outside sRGB", async () => {
    const onchange = vi.fn();
    render(ColourPicker, { props: { value: "oklch(0.75 0.2 145)", onchange } });

    await fireEvent.input(screen.getByLabelText("Lightness"), { target: { value: "0.15" } });

    expect(parseOklch(onchange.mock.calls.at(-1)?.[0] as string)?.c).toBeLessThan(0.2);
  });

  test("dragging through an out-of-gamut region keeps the other axes", async () => {
    render(ColourPicker, { props: { value: "oklch(0.75 0.2 145)" } });

    await fireEvent.input(screen.getByLabelText("Lightness"), { target: { value: "0.15" } });

    // Hue survives even though chroma was clamped on the way through.
    const hue = screen.getByLabelText("Hue") as HTMLInputElement;
    expect(Number(hue.value)).toBeCloseTo(145, 0);
  });

  // The vanilla element regressed here by reading the colour from a build-time
  // closure. Svelte writes back into its bindable `value` and re-renders from
  // it, so no feeding is needed — this pins that it stays true.
  test("moving one slider keeps what the others were already dragged to", async () => {
    const onchange = vi.fn();
    render(ColourPicker, { props: { value: "oklch(0.7 0.15 255)", onchange } });
    const latest = () => onchange.mock.calls.at(-1)?.[0] as string;

    await fireEvent.input(screen.getByLabelText("Lightness"), { target: { value: "0.35" } });
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);

    await fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "300" } });
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);

    await fireEvent.input(screen.getByLabelText("Chroma"), { target: { value: "0.05" } });
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);
    expect(parseOklch(latest())?.h).toBeCloseTo(300, 0);
  });

  test("a chart drag keeps the hue the slider was already moved to", async () => {
    const onchange = vi.fn();
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", onchange, layout: "chart" },
    });
    const latest = () => onchange.mock.calls.at(-1)?.[0] as string;

    await fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "300" } });

    const chart = container.querySelector(".oklch-picker__chart") as SVGSVGElement;
    // happy-dom lays nothing out, so the rect is stubbed to a known box.
    chart.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    chart.setPointerCapture = () => {};
    chart.hasPointerCapture = () => true;

    chart.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );

    // The chart holds hue fixed and sweeps the other two, so the pick must
    // land on the dialled hue rather than reverting to the mounted one.
    expect(parseOklch(latest())?.h).toBeCloseTo(300, 0);
  });

  test("the stacked strips are read-only; only the chart layout's plot drags", () => {
    const onchange = vi.fn();
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", onchange, layout: "stacked" },
    });
    const charts = container.querySelectorAll(".oklch-picker__chart");
    expect(charts).toHaveLength(3);
    for (const c of charts) {
      expect(c.classList.contains("oklch-picker__chart--interactive")).toBe(false);
    }

    // A pointerdown on a strip must not move the colour.
    const strip = charts[0] as SVGSVGElement;
    strip.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    strip.setPointerCapture = () => {};
    strip.hasPointerCapture = () => true;
    strip.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );
    expect(onchange).not.toHaveBeenCalled();

    cleanup();
    const { container: big } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "chart" },
    });
    expect(
      big
        .querySelector(".oklch-picker__chart")
        ?.classList.contains("oklch-picker__chart--interactive"),
    ).toBe(true);
  });

  test("renders presets and selects one on click", async () => {
    const onchange = vi.fn();
    render(ColourPicker, {
      props: {
        value: "oklch(0.7 0.15 255)",
        onchange,
        presets: ["oklch(0.75 0.16 145)"],
      },
    });
    await fireEvent.click(screen.getByLabelText("Green"));
    expect(onchange).toHaveBeenCalledWith("oklch(0.75 0.16 145)");
  });

  test("accepts hex in the hex field", async () => {
    const onchange = vi.fn();
    render(ColourPicker, { props: { value: "oklch(0.7 0.15 255)", onchange } });

    await fireEvent.input(screen.getByLabelText("Hex colour"), { target: { value: "#ff0000" } });

    expect(parseOklch(onchange.mock.calls.at(-1)?.[0] as string)?.h).toBeCloseTo(29.23, 0);
  });

  test("falls back to a usable colour when the value is unparseable", () => {
    render(ColourPicker, { props: { value: "not-a-colour" } });
    expect(screen.getByLabelText("Lightness")).toBeDefined();
  });

  test("parts can be turned off individually", () => {
    const { container } = render(ColourPicker, {
      props: {
        value: "oklch(0.7 0.15 255)",
        parts: { charts: false, hexInput: false, name: false, preview: false },
      },
    });
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(container.querySelector(".oklch-picker__hex")).toBeNull();
    expect(container.querySelector(".oklch-picker__name")).toBeNull();
    expect(container.querySelector(".oklch-picker__footer")).toBeNull();
    expect(screen.getByLabelText("Lightness")).toBeDefined();
  });

  test("the out-of-gamut notice can be turned off", () => {
    const clipped = "oklch(0.2 0.3 145)";
    const { container: withNotice } = render(ColourPicker, { props: { value: clipped } });
    expect(withNotice.querySelector(".oklch-picker__notice")).not.toBeNull();
    cleanup();

    const { container } = render(ColourPicker, {
      props: { value: clipped, parts: { notice: false } },
    });
    expect(container.querySelector(".oklch-picker__notice")).toBeNull();
  });

  test("layouts set a modifier class, and compact drops the charts", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "compact" },
    });
    expect(container.querySelector(".oklch-picker--compact")).not.toBeNull();
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(screen.getByLabelText("Lightness")).toBeDefined();
    cleanup();

    const { container: wide } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "side-by-side" },
    });
    expect(wide.querySelector(".oklch-picker--side-by-side")).not.toBeNull();
    expect(wide.querySelector(".oklch-picker__chart")).not.toBeNull();
  });

  test("the chart layout shows one plot for all three sliders", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "chart" },
    });
    expect(container.querySelector(".oklch-picker--chart")).not.toBeNull();
    // One chart, and it sits above the axes rather than inside one of them.
    expect(container.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
    expect(container.querySelector(".oklch-picker__axis .oklch-picker__chart")).toBeNull();
    // All three sliders remain.
    expect(container.querySelectorAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("stacked gives every axis its own chart", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "stacked" },
    });
    expect(container.querySelectorAll(".oklch-picker__chart")).toHaveLength(3);
  });

  test("no layout means the chart layout", () => {
    const { container } = render(ColourPicker, { props: { value: "oklch(0.7 0.15 255)" } });
    expect(container.querySelector(".oklch-picker--chart")).not.toBeNull();
    expect(container.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
  });

  test("side-by-side shows the same single interactive plot", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "side-by-side" },
    });
    const charts = container.querySelectorAll(".oklch-picker__chart");
    expect(charts).toHaveLength(1);
    expect(charts[0]?.classList.contains("oklch-picker__chart--interactive")).toBe(true);
    // Hoisted above the axes, as in `chart`, not tucked inside one of them.
    expect(container.querySelector(".oklch-picker__axis .oklch-picker__chart")).toBeNull();
  });

  test("parts.charts drops the chart in the chart layout too", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", layout: "chart", parts: { charts: false } },
    });
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(container.querySelectorAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("dragging the chart emits a clamped colour", () => {
    const onchange = vi.fn();
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", onchange, layout: "chart" },
    });
    const chart = container.querySelector(".oklch-picker__chart") as SVGSVGElement;
    // happy-dom lays nothing out, so the rect is stubbed to a known box.
    chart.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    chart.setPointerCapture = () => {};
    chart.hasPointerCapture = () => true;

    chart.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );

    expect(onchange).toHaveBeenCalledTimes(1);
    // Mid-plot: half the lightness range, and whatever chroma that allows.
    expect(parseOklch(onchange.mock.calls[0]?.[0] as string)?.l).toBeCloseTo(0.5, 2);
  });

  test("labels can be translated", () => {
    render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", labels: { l: "Helderheid" } },
    });
    expect(screen.getByLabelText("Helderheid")).toBeDefined();
  });

  test("class prefix is applied so styles can be overridden", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.7 0.15 255)", classPrefix: "my-picker" },
    });
    expect(container.querySelector(".my-picker")).not.toBeNull();
    expect(container.querySelector(".my-picker__axis")).not.toBeNull();
  });

  // Outside sRGB, inside P3 — the colour the gamut tests turn on.
  const wide = "oklch(0.7 0.25 145)";

  test("the sRGB default costs nothing: no boundary, no switcher", () => {
    const { container } = render(ColourPicker, { props: { value: wide } });
    expect(container.querySelector(".oklch-picker__gamut-boundary")).toBeNull();
    expect(container.querySelector(".oklch-picker__gamut-switch")).toBeNull();
  });

  // The whole point of the reshape: choosing P3 emits P3 rather than drawing a
  // P3 outline around a value that was clamped to sRGB anyway.
  test("a P3 output keeps a P3 colour whole, unclipped and unremarked", async () => {
    const onchange = vi.fn();
    const { container } = render(ColourPicker, { props: { value: wide, onchange, gamut: P3 } });
    expect(container.querySelector(".oklch-picker__notice")).toBeNull();

    await fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "145" } });
    // ~0.25, not the ~0.22 sRGB would have clipped it to.
    expect(parseOklch(onchange.mock.calls.at(-1)?.[0] as string)?.c).toBeCloseTo(0.25, 3);
  });

  test("a P3 output outlines sRGB as a reference", () => {
    const { container } = render(ColourPicker, { props: { value: wide, gamut: P3 } });
    const drawn = container.querySelectorAll(".oklch-picker__gamut-boundary");
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.classList.contains("oklch-picker__gamut-boundary--srgb")).toBe(true);
  });

  test("the switcher offers the references and the output, and reports a press", async () => {
    const ongamutchange = vi.fn();
    const { container } = render(ColourPicker, {
      props: { value: wide, gamut: P3, parts: { gamutSwitch: true }, ongamutchange },
    });
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".oklch-picker__gamut-choice"),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(["sRGB", "Display P3"]);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");

    await fireEvent.click(buttons[0] as HTMLButtonElement);
    expect(ongamutchange).toHaveBeenCalledWith(SRGB);
  });

  test("one option is not a choice, so sRGB alone renders no switcher", () => {
    const { container } = render(ColourPicker, {
      props: { value: wide, parts: { gamutSwitch: true } },
    });
    expect(container.querySelector(".oklch-picker__gamut-switch")).toBeNull();
  });

  test("a per-gamut label words the notice for the output space", () => {
    const { container } = render(ColourPicker, {
      props: { value: "oklch(0.8 0.35 145)", gamut: P3, labels: { "outOf:p3": "custom" } },
    });
    expect(container.querySelector(".oklch-picker__notice")?.textContent).toBe("custom");
  });
});
