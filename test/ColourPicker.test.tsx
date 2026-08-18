/** Rendered with Preact via the compat alias, proving the React-API build works there. */
import { parseOklch } from "@oklch-picker/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ColourPicker } from "../packages/react/src/ColourPicker.js";

// Auto-cleanup needs `globals: true`, which this config does not set.
afterEach(cleanup);

describe("ColourPicker (rendered with Preact)", () => {
  test("renders one slider per OKLCH axis", () => {
    render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />);
    expect(screen.getByLabelText("Lightness")).toBeDefined();
    expect(screen.getByLabelText("Chroma")).toBeDefined();
    expect(screen.getByLabelText("Hue")).toBeDefined();
  });

  test("emits a canonical oklch string when a slider moves", () => {
    const onChange = vi.fn();
    render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={onChange} />);

    fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "120" } });

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0]?.[0] as string;
    const parsed = parseOklch(emitted);
    expect(parsed).not.toBeNull();
    expect(parsed?.h).toBeCloseTo(120, 0);
  });

  test("never emits a colour outside sRGB", () => {
    const onChange = vi.fn();
    // Start from a colour whose chroma is impossible at low lightness.
    render(<ColourPicker value="oklch(0.75 0.2 145)" onChange={onChange} />);

    fireEvent.input(screen.getByLabelText("Lightness"), { target: { value: "0.15" } });

    const emitted = onChange.mock.calls.at(-1)?.[0] as string;
    const parsed = parseOklch(emitted);
    expect(parsed).not.toBeNull();
    // Chroma must have been clamped down to something displayable.
    expect(parsed?.c).toBeLessThan(0.2);
  });

  test("renders presets and selects one on click", () => {
    const onChange = vi.fn();
    render(
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={onChange}
        presets={["oklch(0.75 0.16 145)"]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Green"));
    expect(onChange).toHaveBeenCalledWith("oklch(0.75 0.16 145)");
  });

  test("accepts hex in the hex field", () => {
    const onChange = vi.fn();
    render(<ColourPicker value="oklch(0.7 0.15 255)" onChange={onChange} />);

    fireEvent.input(screen.getByLabelText("Hex colour"), { target: { value: "#ff0000" } });

    const emitted = onChange.mock.calls.at(-1)?.[0] as string;
    expect(parseOklch(emitted)?.h).toBeCloseTo(29.23, 0);
  });

  test("falls back to a usable colour when the value is unparseable", () => {
    render(<ColourPicker value="not-a-colour" onChange={() => {}} />);
    // Still renders rather than throwing.
    expect(screen.getByLabelText("Lightness")).toBeDefined();
  });

  test("parts can be turned off individually", () => {
    const { container } = render(
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        parts={{ charts: false, hexInput: false, name: false, preview: false }}
      />,
    );
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(container.querySelector(".oklch-picker__hex")).toBeNull();
    expect(container.querySelector(".oklch-picker__name")).toBeNull();
    // Every footer part is off, so the footer itself is gone.
    expect(container.querySelector(".oklch-picker__footer")).toBeNull();
    // The sliders are never optional.
    expect(screen.getByLabelText("Lightness")).toBeDefined();
  });

  test("the out-of-gamut notice can be turned off", () => {
    // A colour well outside sRGB, so the notice would normally show.
    const clipped = "oklch(0.2 0.3 145)";
    const { container: withNotice } = render(<ColourPicker value={clipped} onChange={() => {}} />);
    expect(withNotice.querySelector(".oklch-picker__notice")).not.toBeNull();
    cleanup();
    const { container } = render(
      <ColourPicker value={clipped} onChange={() => {}} parts={{ notice: false }} />,
    );
    expect(container.querySelector(".oklch-picker__notice")).toBeNull();
  });

  test("layouts set a modifier class, and compact drops the charts", () => {
    const { container } = render(
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="compact" />,
    );
    expect(container.querySelector(".oklch-picker--compact")).not.toBeNull();
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    // Full labels survive for assistive tech even when abbreviated visually.
    expect(screen.getByLabelText("Lightness")).toBeDefined();
    cleanup();
    const { container: wide } = render(
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="side-by-side" />,
    );
    expect(wide.querySelector(".oklch-picker--side-by-side")).not.toBeNull();
    expect(wide.querySelector(".oklch-picker__chart")).not.toBeNull();
  });

  test("labels can be translated", () => {
    render(
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} labels={{ l: "Helderheid" }} />,
    );
    expect(screen.getByLabelText("Helderheid")).toBeDefined();
  });

  test("class prefix is applied so styles can be overridden", () => {
    const { container } = render(
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} classPrefix="my-picker" />,
    );
    expect(container.querySelector(".my-picker")).not.toBeNull();
    expect(container.querySelector(".my-picker__axis")).not.toBeNull();
  });
});
