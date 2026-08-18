/** The Vue adapter, asserting the same behaviour as the React suite. */
import { parseOklch } from "@oklch-picker/core";
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
});
