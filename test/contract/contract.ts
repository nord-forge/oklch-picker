/** Every behaviour an adapter owes, described once.
 *
 * Call `adapterContract(driver)` from an adapter's own suite. Anything unique
 * to that adapter belongs beside the call, not in here. See `driver.ts` for why
 * the split is drawn there.
 */
import { SRGB, inGamut, parseOklch } from "@oklch-picker/core";
import { P3, REC2020 } from "@oklch-picker/core/gamuts";
import { afterEach, describe, expect, test } from "vitest";
import type { Driver, Mounted, PickerProps } from "./driver.js";

const PRESETS = ["oklch(0.75 0.16 145)", "oklch(0.5 0.1 30)"];

export function adapterContract(driver: Driver): void {
  describe(`the adapter contract (${driver.name})`, () => {
    afterEach(async () => {
      await driver.cleanup?.();
    });

    const mount = (props: PickerProps = {}) =>
      Promise.resolve(driver.mount({ value: "oklch(0.7 0.15 255)", ...props }));

    /** Declared unsupported, with a reason, runs as a skip rather than silently
     * vanishing. Anything not declared has to pass. */
    const it = (name: string, body: (m: Mounted) => Promise<void> | void, props?: PickerProps) => {
      const why = driver.unsupported?.[name];
      if (why) {
        test.skip(`${name} [unsupported: ${why}]`, () => {});
        return;
      }
      test(name, async () => {
        await body(await mount(props));
      });
    };

    const sliders = (m: Mounted) => [
      ...m.root.querySelectorAll<HTMLInputElement>("input[type=range]"),
    ];
    const byLabel = (m: Mounted, label: string) =>
      m.root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    const last = (m: Mounted) => m.emitted.at(-1) ?? "";

    // ---- structure -------------------------------------------------------

    it("renders one slider per OKLCH axis", (m) => {
      for (const label of ["Lightness", "Chroma", "Hue"]) {
        expect(byLabel(m, label), `no ${label} slider`).not.toBeNull();
      }
    });

    it("no layout means the chart layout", (m) => {
      expect(m.root.querySelector(".oklch-picker--chart")).not.toBeNull();
    });

    it("the chart layout shows one plot for all three sliders", (m) => {
      expect(m.root.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
    });

    it(
      "stacked gives every axis its own chart",
      (m) => {
        expect(m.root.querySelectorAll(".oklch-picker__chart")).toHaveLength(3);
      },
      { layout: "stacked" },
    );

    it(
      "layouts set a modifier class, and compact drops the charts",
      (m) => {
        expect(m.root.querySelector(".oklch-picker--compact")).not.toBeNull();
        expect(m.root.querySelector(".oklch-picker__chart")).toBeNull();
      },
      { layout: "compact" },
    );

    it(
      "class prefix is applied so styles can be overridden",
      (m) => {
        expect(m.root.querySelector(".brand")).not.toBeNull();
        expect(m.root.querySelector(".oklch-picker")).toBeNull();
      },
      { classPrefix: "brand" },
    );

    it(
      "labels can be translated",
      (m) => {
        expect(m.root.textContent).toContain("Helderheid");
      },
      { labels: { l: "Helderheid" } },
    );

    // ---- emitting --------------------------------------------------------

    it("emits a canonical oklch string when a slider moves", async (m) => {
      await m.set(byLabel(m, "Hue") as HTMLInputElement, "120");
      expect(last(m)).toMatch(/^oklch\(/);
      expect(parseOklch(last(m))?.h).toBeCloseTo(120, 0);
    });

    it("never emits a colour outside the gamut", async (m) => {
      // Chroma impossible at the lightness this drags to.
      await m.set(byLabel(m, "Lightness") as HTMLInputElement, "0.15");
      const parsed = parseOklch(last(m));
      expect(parsed).not.toBeNull();
      expect(parsed?.c).toBeLessThan(0.2);
    });

    it("moving one slider keeps what the others were already dragged to", async (m) => {
      await m.set(byLabel(m, "Lightness") as HTMLInputElement, "0.35");
      expect(parseOklch(last(m))?.l).toBeCloseTo(0.35, 2);
      await m.set(byLabel(m, "Hue") as HTMLInputElement, "300");
      expect(parseOklch(last(m))?.l).toBeCloseTo(0.35, 2);
      expect(parseOklch(last(m))?.h).toBeCloseTo(300, 0);
    });

    it("dragging through an unreachable region keeps the other axes", async (m) => {
      // The draft is not the stored value: a clamped chroma must not destroy
      // the hue that follows it.
      await m.set(byLabel(m, "Chroma") as HTMLInputElement, "0.4");
      await m.set(byLabel(m, "Hue") as HTMLInputElement, "300");
      expect(parseOklch(last(m))?.h).toBeCloseTo(300, 0);
    });

    it(
      "falls back to a usable colour when the value is unparseable",
      (m) => {
        expect(sliders(m).length).toBeGreaterThanOrEqual(3);
      },
      { value: "not a colour" },
    );

    // ---- presets and recents ---------------------------------------------

    it(
      "renders presets and selects one on click",
      async (m) => {
        const buttons = m.root.querySelectorAll(".oklch-picker__preset");
        expect(buttons).toHaveLength(2);
        await m.click(buttons[1] as Element);
        expect(last(m)).toBe(PRESETS[1]);
      },
      { presets: PRESETS },
    );

    it("renders nothing until a colour is committed", (m) => {
      expect(m.root.querySelector(".oklch-picker__recents")).toBeNull();
    });

    it(
      "a preset click records a recent colour",
      async (m) => {
        await m.click(m.root.querySelector(".oklch-picker__preset") as Element);
        expect(m.root.querySelectorAll(".oklch-picker__recent").length).toBeGreaterThan(0);
      },
      { presets: PRESETS },
    );

    it(
      "the controlled list is what renders",
      (m) => {
        expect(m.root.querySelectorAll(".oklch-picker__recent")).toHaveLength(2);
      },
      { recents: ["oklch(0.6 0.1 200)", "oklch(0.4 0.05 40)"] },
    );

    it(
      "parts.recents turns the row off",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__recents")).toBeNull();
      },
      { recents: ["oklch(0.6 0.1 200)"], parts: { recents: false } },
    );

    // ---- parts -----------------------------------------------------------

    it(
      "parts can be turned off individually",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__chart")).toBeNull();
        expect(m.root.querySelector(".oklch-picker__name")).toBeNull();
      },
      { parts: { charts: false, name: false } },
    );

    it(
      "parts.charts drops the chart in the chart layout too",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__chart")).toBeNull();
      },
      { layout: "chart", parts: { charts: false } },
    );

    it(
      "parts.alpha removes the slider",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__alpha")).toBeNull();
      },
      { parts: { alpha: false } },
    );

    it("the hex field is opt-in, and oklch shows by default", (m) => {
      expect(m.root.querySelector(".oklch-picker__field--oklch")).not.toBeNull();
      expect(m.root.querySelector(".oklch-picker__field--hex")).toBeNull();
    });

    it(
      "the hex field appears when asked for",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__field--hex")).not.toBeNull();
      },
      { parts: { hexInput: true } },
    );

    // ---- gamuts ----------------------------------------------------------

    it("the sRGB default costs nothing: no boundary, no switcher", (m) => {
      expect(m.root.querySelector(".oklch-picker__gamut-boundary")).toBeNull();
      expect(m.root.querySelector(".oklch-picker__gamut-switch")).toBeNull();
    });

    it(
      "a P3 output keeps a P3 colour whole",
      async (m) => {
        await m.set(byLabel(m, "Lightness") as HTMLInputElement, "0.75");
        const parsed = parseOklch(last(m));
        expect(parsed).not.toBeNull();
        expect(inGamut(parsed as never, P3)).toBe(true);
      },
      { value: "oklch(0.75 0.25 145)", gamut: P3 },
    );

    it(
      "a P3 output reaches further than sRGB would",
      async (m) => {
        await m.set(byLabel(m, "Lightness") as HTMLInputElement, "0.75");
        const wide = parseOklch(last(m))?.c ?? 0;
        await driver.cleanup?.();
        const narrow = await mount({ value: "oklch(0.75 0.25 145)" });
        await narrow.set(byLabel(narrow, "Lightness") as HTMLInputElement, "0.75");
        expect(wide).toBeGreaterThan(parseOklch(narrow.emitted.at(-1) ?? "")?.c ?? 0);
      },
      { value: "oklch(0.75 0.25 145)", gamut: P3 },
    );

    it(
      "a P3 output outlines sRGB as a reference",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__gamut-boundary--srgb")).not.toBeNull();
      },
      { gamut: P3 },
    );

    it(
      "the switcher offers the choices and reports a press",
      async (m) => {
        const choices = m.root.querySelectorAll(".oklch-picker__gamut-choice");
        expect(choices).toHaveLength(3);
        await m.click(choices[1] as Element);
        expect(m.gamuts.at(-1)?.id).toBe("p3");
      },
      { gamutChoices: [SRGB, P3, REC2020], parts: { gamutSwitch: true } },
    );

    it(
      "one option is not a choice, so sRGB alone renders no switcher",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__gamut-switch")).toBeNull();
      },
      { gamutChoices: [SRGB], parts: { gamutSwitch: true } },
    );

    // ---- text fields -----------------------------------------------------

    it("a field accepts any supported format, whichever it shows", async (m) => {
      const field = m.root.querySelector<HTMLInputElement>(".oklch-picker__field--oklch");
      expect(field).not.toBeNull();
      // Pasting a hex into the oklch field works, rather than being a rule to
      // learn.
      await m.set(field as HTMLInputElement, "#3366ff");
      expect(last(m)).toMatch(/^oklch\(/);
    });
  });
}
