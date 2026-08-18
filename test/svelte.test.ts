/** The Svelte adapter, asserting the same behaviour as the React suite. */
import { parseOklch } from "@oklch-picker/core";
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
});
