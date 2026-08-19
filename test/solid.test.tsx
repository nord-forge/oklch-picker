/** The Solid adapter, asserting the same behaviour as the React suite. */
import { SRGB, parseOklch } from "@oklch-picker/core";
import { P3 } from "@oklch-picker/core/gamuts";
import { ColourPicker } from "@oklch-picker/solid";
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(cleanup);

describe("ColourPicker (Solid)", () => {
  test("renders one slider per OKLCH axis", () => {
    render(() => <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />);
    expect(screen.getByLabelText("Lightness")).toBeDefined();
    expect(screen.getByLabelText("Chroma")).toBeDefined();
    expect(screen.getByLabelText("Hue")).toBeDefined();
  });

  test("emits a canonical oklch string when a slider moves", () => {
    const onChange = vi.fn();
    render(() => <ColourPicker value="oklch(0.7 0.15 255)" onChange={onChange} />);

    fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "120" } });

    expect(onChange).toHaveBeenCalled();
    expect(parseOklch(onChange.mock.calls[0]?.[0] as string)?.h).toBeCloseTo(120, 0);
  });

  test("never emits a colour outside sRGB", () => {
    const onChange = vi.fn();
    render(() => <ColourPicker value="oklch(0.75 0.2 145)" onChange={onChange} />);

    fireEvent.input(screen.getByLabelText("Lightness"), { target: { value: "0.15" } });

    expect(parseOklch(onChange.mock.calls.at(-1)?.[0] as string)?.c).toBeLessThan(0.2);
  });

  // The vanilla element regressed here by reading the colour from a build-time
  // closure. Solid reads its props lazily, so this pins that it stays true.
  test("moving one slider keeps what the others were already dragged to", () => {
    // Controlled: a signal feeds the emitted value straight back as the prop.
    const [value, setValue] = createSignal("oklch(0.7 0.15 255)");
    const onChange = vi.fn(setValue);
    render(() => <ColourPicker value={value()} onChange={onChange} />);
    const latest = () => onChange.mock.calls.at(-1)?.[0] as string;

    fireEvent.input(screen.getByLabelText("Lightness"), { target: { value: "0.35" } });
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);

    fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "300" } });
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);

    fireEvent.input(screen.getByLabelText("Chroma"), { target: { value: "0.05" } });
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);
    expect(parseOklch(latest())?.h).toBeCloseTo(300, 0);
  });

  test("a chart drag keeps the hue the slider was already moved to", () => {
    const [value, setValue] = createSignal("oklch(0.7 0.15 255)");
    const onChange = vi.fn(setValue);
    const { container } = render(() => (
      <ColourPicker value={value()} onChange={onChange} layout="chart" />
    ));
    const latest = () => onChange.mock.calls.at(-1)?.[0] as string;

    fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "300" } });

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
    const onChange = vi.fn();
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={onChange} layout="stacked" />
    ));
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
    expect(onChange).not.toHaveBeenCalled();

    cleanup();
    const { container: big } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="chart" />
    ));
    expect(
      big
        .querySelector(".oklch-picker__chart")
        ?.classList.contains("oklch-picker__chart--interactive"),
    ).toBe(true);
  });

  test("renders presets and selects one on click", () => {
    const onChange = vi.fn();
    render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={onChange}
        presets={["oklch(0.75 0.16 145)"]}
      />
    ));
    fireEvent.click(screen.getByLabelText("Green"));
    expect(onChange).toHaveBeenCalledWith("oklch(0.75 0.16 145)");
  });

  test("accepts hex in the hex field", () => {
    const onChange = vi.fn();
    render(() => <ColourPicker value="oklch(0.7 0.15 255)" onChange={onChange} />);

    fireEvent.input(screen.getByLabelText("Hex colour"), { target: { value: "#ff0000" } });

    expect(parseOklch(onChange.mock.calls.at(-1)?.[0] as string)?.h).toBeCloseTo(29.23, 0);
  });

  test("falls back to a usable colour when the value is unparseable", () => {
    render(() => <ColourPicker value="not-a-colour" onChange={() => {}} />);
    expect(screen.getByLabelText("Lightness")).toBeDefined();
  });

  test("parts can be turned off individually", () => {
    const { container } = render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        parts={{ charts: false, hexInput: false, name: false, preview: false }}
      />
    ));
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(container.querySelector(".oklch-picker__hex")).toBeNull();
    expect(container.querySelector(".oklch-picker__name")).toBeNull();
    expect(container.querySelector(".oklch-picker__footer")).toBeNull();
    expect(screen.getByLabelText("Lightness")).toBeDefined();
  });

  test("the out-of-gamut notice can be turned off", () => {
    const clipped = "oklch(0.2 0.3 145)";
    const { container: withNotice } = render(() => (
      <ColourPicker value={clipped} onChange={() => {}} />
    ));
    expect(withNotice.querySelector(".oklch-picker__notice")).not.toBeNull();
    cleanup();

    const { container } = render(() => (
      <ColourPicker value={clipped} onChange={() => {}} parts={{ notice: false }} />
    ));
    expect(container.querySelector(".oklch-picker__notice")).toBeNull();
  });

  test("layouts set a modifier class, and compact drops the charts", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="compact" />
    ));
    expect(container.querySelector(".oklch-picker--compact")).not.toBeNull();
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(screen.getByLabelText("Lightness")).toBeDefined();
    cleanup();

    const { container: wide } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="side-by-side" />
    ));
    expect(wide.querySelector(".oklch-picker--side-by-side")).not.toBeNull();
    expect(wide.querySelector(".oklch-picker__chart")).not.toBeNull();
  });

  test("the chart layout shows one plot for all three sliders", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="chart" />
    ));
    expect(container.querySelector(".oklch-picker--chart")).not.toBeNull();
    // One chart, and it sits above the axes rather than inside one of them.
    expect(container.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
    expect(container.querySelector(".oklch-picker__axis .oklch-picker__chart")).toBeNull();
    // All three sliders remain.
    expect(container.querySelectorAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("stacked gives every axis its own chart", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="stacked" />
    ));
    expect(container.querySelectorAll(".oklch-picker__chart")).toHaveLength(3);
  });

  test("no layout means the chart layout", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />
    ));
    expect(container.querySelector(".oklch-picker--chart")).not.toBeNull();
    expect(container.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
  });

  test("side-by-side shows the same single interactive plot", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} layout="side-by-side" />
    ));
    const charts = container.querySelectorAll(".oklch-picker__chart");
    expect(charts).toHaveLength(1);
    expect(charts[0]?.classList.contains("oklch-picker__chart--interactive")).toBe(true);
    // Hoisted above the axes, as in `chart`, not tucked inside one of them.
    expect(container.querySelector(".oklch-picker__axis .oklch-picker__chart")).toBeNull();
  });

  test("parts.charts drops the chart in the chart layout too", () => {
    const { container } = render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        layout="chart"
        parts={{ charts: false }}
      />
    ));
    expect(container.querySelector(".oklch-picker__chart")).toBeNull();
    expect(container.querySelectorAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("dragging the chart emits a clamped colour", () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={onChange} layout="chart" />
    ));
    const chart = container.querySelector(".oklch-picker__chart") as SVGSVGElement;
    // happy-dom lays nothing out, so the rect is stubbed to a known box.
    chart.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    chart.setPointerCapture = () => {};
    chart.hasPointerCapture = () => true;

    chart.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    // Mid-plot: half the lightness range, and whatever chroma that allows.
    expect(parseOklch(onChange.mock.calls[0]?.[0] as string)?.l).toBeCloseTo(0.5, 2);
  });

  test("labels can be translated", () => {
    render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} labels={{ l: "Helderheid" }} />
    ));
    expect(screen.getByLabelText("Helderheid")).toBeDefined();
  });

  test("class prefix is applied so styles can be overridden", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} classPrefix="my-picker" />
    ));
    expect(container.querySelector(".my-picker")).not.toBeNull();
    expect(container.querySelector(".my-picker__axis")).not.toBeNull();
  });

  // Outside sRGB, inside P3. This is the colour the gamut tests turn on.
  const wide = "oklch(0.7 0.25 145)";

  test("the sRGB default costs nothing: no boundary, no switcher", () => {
    const { container } = render(() => <ColourPicker value={wide} onChange={() => {}} />);
    expect(container.querySelector(".oklch-picker__gamut-boundary")).toBeNull();
    expect(container.querySelector(".oklch-picker__gamut-switch")).toBeNull();
  });

  // The whole point of the reshape: choosing P3 emits P3 rather than drawing a
  // P3 outline around a value that was clamped to sRGB anyway.
  test("a P3 output keeps a P3 colour whole, unclipped and unremarked", () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <ColourPicker value={wide} onChange={onChange} gamut={P3} />
    ));
    expect(container.querySelector(".oklch-picker__notice")).toBeNull();

    fireEvent.input(screen.getByLabelText("Hue"), { target: { value: "145" } });
    // ~0.25, not the ~0.22 sRGB would have clipped it to.
    expect(parseOklch(onChange.mock.calls.at(-1)?.[0] as string)?.c).toBeCloseTo(0.25, 3);
  });

  test("a P3 output outlines sRGB as a reference", () => {
    const { container } = render(() => (
      <ColourPicker value={wide} onChange={() => {}} gamut={P3} />
    ));
    const drawn = container.querySelectorAll(".oklch-picker__gamut-boundary");
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.classList.contains("oklch-picker__gamut-boundary--srgb")).toBe(true);
  });

  test("the switcher offers the references and the output, and reports a press", () => {
    const onGamutChange = vi.fn();
    const { container } = render(() => (
      <ColourPicker
        value={wide}
        onChange={() => {}}
        gamut={P3}
        parts={{ gamutSwitch: true }}
        onGamutChange={onGamutChange}
      />
    ));
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".oklch-picker__gamut-choice"),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.textContent)).toEqual(["sRGB", "Display P3"]);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(buttons[0] as HTMLButtonElement);
    expect(onGamutChange).toHaveBeenCalledWith(SRGB);
  });

  test("one option is not a choice, so sRGB alone renders no switcher", () => {
    const { container } = render(() => (
      <ColourPicker value={wide} onChange={() => {}} parts={{ gamutSwitch: true }} />
    ));
    expect(container.querySelector(".oklch-picker__gamut-switch")).toBeNull();
  });

  test("a per-gamut label words the notice for the output space", () => {
    const { container } = render(() => (
      <ColourPicker
        value="oklch(0.8 0.35 145)"
        onChange={() => {}}
        gamut={P3}
        labels={{ "outOf:p3": "custom" }}
      />
    ));
    expect(container.querySelector(".oklch-picker__notice")?.textContent).toBe("custom");
  });
});

describe("recent colours (Solid)", () => {
  test("renders nothing until a colour is committed", () => {
    const { container } = render(() => (
      <ColourPicker value="oklch(0.7 0.15 255)" onChange={() => {}} />
    ));
    expect(container.querySelector(".oklch-picker__recents")).toBeNull();
  });

  // The whole point of committing on release: a drag calls `onChange` for every
  // value it passes through, and recording each would bury the list.
  test("a drag records once, not once per value", () => {
    const onRecentsChange = vi.fn();
    render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        onRecentsChange={onRecentsChange}
      />
    ));
    // Held, not re-queried: the axis rows render through `Index`, so the node
    // a drag started on is the node it ends on. `For` would have replaced it
    // on every keystroke, taking focus and pointer capture with it.
    const hue = screen.getByLabelText("Hue");
    for (const v of ["100", "150", "200", "250", "300"]) {
      fireEvent.input(hue, { target: { value: v } });
    }
    expect(onRecentsChange).not.toHaveBeenCalled(); // the gesture is still running
    fireEvent.pointerUp(hue);
    expect(onRecentsChange).toHaveBeenCalledTimes(1);
    expect(onRecentsChange.mock.calls[0]?.[0]).toHaveLength(1);
  });

  test("a preset is committed on click", () => {
    const onRecentsChange = vi.fn();
    render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        presets={["oklch(0.75 0.16 145)"]}
        onRecentsChange={onRecentsChange}
      />
    ));
    fireEvent.click(screen.getByLabelText("Green"));
    expect(onRecentsChange.mock.calls.at(-1)?.[0]).toEqual(["oklch(0.75 0.16 145)"]);
  });

  test("the controlled list is what renders", () => {
    const { container } = render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        recents={["oklch(0.75 0.16 145)", "oklch(0.5 0.1 30)"]}
      />
    ));
    expect(container.querySelectorAll(".oklch-picker__recent")).toHaveLength(2);
  });

  test("parts.recents turns the row off", () => {
    const { container } = render(() => (
      <ColourPicker
        value="oklch(0.7 0.15 255)"
        onChange={() => {}}
        recents={["oklch(0.75 0.16 145)"]}
        parts={{ recents: false }}
      />
    ));
    expect(container.querySelector(".oklch-picker__recents")).toBeNull();
  });
});
