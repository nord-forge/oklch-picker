/** The Vue adapter, asserting the same behaviour as the React suite. */
import { SRGB, parseOklch } from "@oklch-picker/core";
import { P3 } from "@oklch-picker/core/gamuts";
import { ColourPicker } from "@oklch-picker/vue";
import { mount } from "@vue/test-utils";
import { describe, expect, test } from "vitest";

const slider = (w: ReturnType<typeof mount>, label: string) =>
  w.find(`input[aria-label="${label}"]`);

/** What `v-model` would receive, in order. */
const emitted = (w: ReturnType<typeof mount>) =>
  (w.emitted("update:modelValue") ?? []).map((e) => (e as string[])[0] as string);

describe("ColourPicker (Vue)", () => {
  test("renders one slider per OKLCH axis", () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    expect(slider(w, "Lightness").exists()).toBe(true);
    expect(slider(w, "Chroma").exists()).toBe(true);
    expect(slider(w, "Hue").exists()).toBe(true);
  });

  test("emits a canonical oklch string for v-model when a slider moves", async () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    await slider(w, "Hue").setValue("120");

    const values = emitted(w);
    expect(values).toHaveLength(1);
    expect(parseOklch(values[0] as string)?.h).toBeCloseTo(120, 0);
    // The `change` event mirrors it, for callers not using v-model.
    expect(w.emitted("change")).toHaveLength(1);
  });

  test("never emits a colour outside sRGB", async () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.75 0.2 145)" } });
    await slider(w, "Lightness").setValue("0.15");
    expect(parseOklch(emitted(w).at(-1) as string)?.c).toBeLessThan(0.2);
  });

  test("dragging through an out-of-gamut region keeps the other axes", async () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.75 0.2 145)" } });
    await slider(w, "Lightness").setValue("0.15");
    // Vue re-renders from the prop, so feed the emitted value back as v-model would.
    await w.setProps({ modelValue: emitted(w).at(-1) as string });
    expect(Number((slider(w, "Hue").element as HTMLInputElement).value)).toBeCloseTo(145, 0);
  });

  // The vanilla element regressed here by reading the colour from a build-time
  // closure. Vue re-renders from the prop, so this pins that it stays true.
  test("moving one slider keeps what the others were already dragged to", async () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    const latest = () => emitted(w).at(-1) as string;
    // Controlled: feed the emitted value back as v-model would.
    const feed = () => w.setProps({ modelValue: latest() });

    await slider(w, "Lightness").setValue("0.35");
    await feed();
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);

    await slider(w, "Hue").setValue("300");
    await feed();
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);

    await slider(w, "Chroma").setValue("0.05");
    expect(parseOklch(latest())?.l).toBeCloseTo(0.35, 2);
    expect(parseOklch(latest())?.h).toBeCloseTo(300, 0);
  });

  test("a chart drag keeps the hue the slider was already moved to", async () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "chart" },
    });
    const latest = () => emitted(w).at(-1) as string;

    await slider(w, "Hue").setValue("300");
    await w.setProps({ modelValue: latest() });

    const chart = w.find(".oklch-picker__chart").element as SVGSVGElement;
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
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "stacked" },
    });
    const charts = w.findAll(".oklch-picker__chart");
    expect(charts).toHaveLength(3);
    for (const c of charts) {
      expect(c.classes()).not.toContain("oklch-picker__chart--interactive");
    }

    // A pointerdown on a strip must not move the colour.
    const strip = charts[0]?.element as SVGSVGElement;
    strip.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    strip.setPointerCapture = () => {};
    strip.hasPointerCapture = () => true;
    strip.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );
    expect(emitted(w)).toHaveLength(0);

    const big = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "chart" },
    });
    expect(big.find(".oklch-picker__chart").classes()).toContain(
      "oklch-picker__chart--interactive",
    );
  });

  test("renders presets and selects one on click", async () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", presets: ["oklch(0.75 0.16 145)"] },
    });
    await w.find('button[aria-label="Green"]').trigger("click");
    expect(emitted(w)).toEqual(["oklch(0.75 0.16 145)"]);
  });

  test("accepts hex in the hex field", async () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    await w.find(".oklch-picker__hex").setValue("#ff0000");
    expect(parseOklch(emitted(w).at(-1) as string)?.h).toBeCloseTo(29.23, 0);
  });

  test("falls back to a usable colour when the value is unparseable", () => {
    const w = mount(ColourPicker, { props: { modelValue: "not-a-colour" } });
    expect(slider(w, "Lightness").exists()).toBe(true);
  });

  test("parts can be turned off individually", () => {
    const w = mount(ColourPicker, {
      props: {
        modelValue: "oklch(0.7 0.15 255)",
        parts: { charts: false, hexInput: false, name: false, preview: false },
      },
    });
    expect(w.find(".oklch-picker__chart").exists()).toBe(false);
    expect(w.find(".oklch-picker__hex").exists()).toBe(false);
    expect(w.find(".oklch-picker__name").exists()).toBe(false);
    expect(w.find(".oklch-picker__footer").exists()).toBe(false);
    expect(slider(w, "Lightness").exists()).toBe(true);
  });

  test("the out-of-gamut notice can be turned off", () => {
    const clipped = "oklch(0.2 0.3 145)";
    const shown = mount(ColourPicker, { props: { modelValue: clipped } });
    expect(shown.find(".oklch-picker__notice").exists()).toBe(true);

    const hidden = mount(ColourPicker, {
      props: { modelValue: clipped, parts: { notice: false } },
    });
    expect(hidden.find(".oklch-picker__notice").exists()).toBe(false);
  });

  test("layouts set a modifier class, and compact drops the charts", () => {
    const compact = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "compact" },
    });
    expect(compact.find(".oklch-picker--compact").exists()).toBe(true);
    expect(compact.find(".oklch-picker__chart").exists()).toBe(false);
    expect(slider(compact, "Lightness").exists()).toBe(true);

    const wide = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "side-by-side" },
    });
    expect(wide.find(".oklch-picker--side-by-side").exists()).toBe(true);
    expect(wide.find(".oklch-picker__chart").exists()).toBe(true);
  });

  test("the chart layout shows one plot for all three sliders", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "chart" },
    });
    expect(w.find(".oklch-picker--chart").exists()).toBe(true);
    // One chart, and it sits above the axes rather than inside one of them.
    expect(w.findAll(".oklch-picker__chart")).toHaveLength(1);
    expect(w.find(".oklch-picker__axis .oklch-picker__chart").exists()).toBe(false);
    // All three sliders remain.
    expect(w.findAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("stacked gives every axis its own chart", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "stacked" },
    });
    expect(w.findAll(".oklch-picker__chart")).toHaveLength(3);
  });

  test("no layout means the chart layout", () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    expect(w.find(".oklch-picker--chart").exists()).toBe(true);
    expect(w.findAll(".oklch-picker__chart")).toHaveLength(1);
  });

  test("side-by-side shows the same single interactive plot", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "side-by-side" },
    });
    const charts = w.findAll(".oklch-picker__chart");
    expect(charts).toHaveLength(1);
    expect(charts[0]?.classes()).toContain("oklch-picker__chart--interactive");
    // Hoisted above the axes, as in `chart`, not tucked inside one of them.
    expect(w.find(".oklch-picker__axis .oklch-picker__chart").exists()).toBe(false);
  });

  test("parts.charts drops the chart in the chart layout too", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "chart", parts: { charts: false } },
    });
    expect(w.find(".oklch-picker__chart").exists()).toBe(false);
    expect(w.findAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("dragging the chart emits a clamped colour", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", layout: "chart" },
    });
    const chart = w.find(".oklch-picker__chart").element as SVGSVGElement;
    // happy-dom lays nothing out, so the rect is stubbed to a known box.
    chart.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    chart.setPointerCapture = () => {};
    chart.hasPointerCapture = () => true;

    chart.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );

    const values = emitted(w);
    expect(values).toHaveLength(1);
    // Mid-plot: half the lightness range, and whatever chroma that allows.
    expect(parseOklch(values[0] as string)?.l).toBeCloseTo(0.5, 2);
  });

  test("labels can be translated", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", labels: { l: "Helderheid" } },
    });
    expect(slider(w, "Helderheid").exists()).toBe(true);
  });

  test("class prefix is applied so styles can be overridden", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", classPrefix: "my-picker" },
    });
    expect(w.find(".my-picker").exists()).toBe(true);
    expect(w.find(".my-picker__axis").exists()).toBe(true);
  });

  // Outside sRGB, inside P3. This is the colour the gamut tests turn on.
  const wide = "oklch(0.7 0.25 145)";

  test("the sRGB default costs nothing: no boundary, no switcher", () => {
    const w = mount(ColourPicker, { props: { modelValue: wide } });
    expect(w.find(".oklch-picker__gamut-boundary").exists()).toBe(false);
    expect(w.find(".oklch-picker__gamut-switch").exists()).toBe(false);
  });

  // The whole point of the reshape: choosing P3 emits P3 rather than drawing a
  // P3 outline around a value that was clamped to sRGB anyway.
  test("a P3 output keeps a P3 colour whole, unclipped and unremarked", async () => {
    const w = mount(ColourPicker, { props: { modelValue: wide, gamut: P3 } });
    expect(w.find(".oklch-picker__notice").exists()).toBe(false);

    await slider(w, "Hue").setValue("145");
    // ~0.25, not the ~0.22 sRGB would have clipped it to.
    expect(parseOklch(emitted(w).at(-1) as string)?.c).toBeCloseTo(0.25, 3);
  });

  test("a P3 output outlines sRGB as a reference", () => {
    const w = mount(ColourPicker, { props: { modelValue: wide, gamut: P3 } });
    const drawn = w.findAll(".oklch-picker__gamut-boundary");
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.classes()).toContain("oklch-picker__gamut-boundary--srgb");
  });

  test("the switcher offers the references and the output, and reports a press", async () => {
    const w = mount(ColourPicker, {
      props: { modelValue: wide, gamut: P3, parts: { gamutSwitch: true } },
    });
    const buttons = w.findAll(".oklch-picker__gamut-choice");
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.text())).toEqual(["sRGB", "Display P3"]);
    expect(buttons[1]?.attributes("aria-pressed")).toBe("true");

    await buttons[0]?.trigger("click");
    expect(w.emitted("gamutChange")?.[0]).toEqual([SRGB]);
  });

  test("one option is not a choice, so sRGB alone renders no switcher", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: wide, parts: { gamutSwitch: true } },
    });
    expect(w.find(".oklch-picker__gamut-switch").exists()).toBe(false);
  });

  test("a per-gamut label words the notice for the output space", () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.8 0.35 145)", gamut: P3, labels: { "outOf:p3": "custom" } },
    });
    expect(w.find(".oklch-picker__notice").text()).toBe("custom");
  });
});

describe("recent colours (Vue)", () => {
  /** Each `recentsChange` payload, as the list it carried. */
  const recorded = (w: ReturnType<typeof mount>) =>
    (w.emitted("recentsChange") ?? []).map((e) => (e as string[][])[0] as string[]);

  test("renders nothing until a colour is committed", () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    expect(w.find(".oklch-picker__recents").exists()).toBe(false);
  });

  // The whole point of committing on release: a drag emits for every value it
  // passes through, and recording each would bury the list.
  test("a drag records once, not once per value", async () => {
    const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
    const hue = slider(w, "Hue");
    for (const v of ["100", "150", "200", "250", "300"]) {
      await hue.setValue(v);
    }
    expect(recorded(w)).toHaveLength(0); // nothing yet, the gesture is still running
    await hue.trigger("pointerup");
    expect(recorded(w)).toHaveLength(1);
    expect(recorded(w)[0]).toHaveLength(1);
  });

  test("a preset is committed on click", async () => {
    const w = mount(ColourPicker, {
      props: { modelValue: "oklch(0.7 0.15 255)", presets: ["oklch(0.75 0.16 145)"] },
    });
    await w.find('button[aria-label="Green"]').trigger("click");
    expect(recorded(w).at(-1)).toEqual(["oklch(0.75 0.16 145)"]);
  });

  test("the controlled list is what renders", () => {
    const w = mount(ColourPicker, {
      props: {
        modelValue: "oklch(0.7 0.15 255)",
        recents: ["oklch(0.75 0.16 145)", "oklch(0.5 0.1 30)"],
      },
    });
    expect(w.findAll(".oklch-picker__recent")).toHaveLength(2);
  });

  test("parts.recents turns the row off", () => {
    const w = mount(ColourPicker, {
      props: {
        modelValue: "oklch(0.7 0.15 255)",
        recents: ["oklch(0.75 0.16 145)"],
        parts: { recents: false },
      },
    });
    expect(w.find(".oklch-picker__recents").exists()).toBe(false);
  });
});
