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

    /** Present and visible, rather than merely present.
     *
     * The framework adapters render a part or do not. `vanilla` has no virtual
     * DOM, so it builds every node once and toggles `hidden` instead, because
     * rebuilding the tree on each input would drop focus from a slider
     * mid-drag. Both are the same thing to a user, and the contract describes
     * what a user sees.
     *
     * A live region is the third shape: the notice stays mounted in every
     * adapter and empties instead, because a region added at the moment it has
     * something to say is never announced. Empty is also nothing to see, and
     * the stylesheet collapses it, so it counts as not shown. */
    const shows = (m: Mounted, selector: string): boolean => {
      const el = m.root.querySelector<HTMLElement>(selector);
      return el !== null && !el.hidden && el.textContent !== "";
    };

    // ---- structure -------------------------------------------------------

    it("renders one slider per OKLCH axis", (m) => {
      for (const label of ["Lightness", "Chroma", "Hue"]) {
        expect(byLabel(m, label), `no ${label} slider`).not.toBeNull();
      }
    });

    // A range input announces its raw `value`, and "0.13" carries no unit. It
    // is worst for chroma, whose maximum is recomputed per colour: the same
    // number is a fifth of the range at one lightness and nearly all of it at
    // another, so the text has to name the maximum it is measured against.
    it("every slider says what its value means", (m) => {
      for (const label of ["Lightness", "Chroma", "Hue"]) {
        const slider = byLabel(m, label) as HTMLInputElement;
        const text = slider.getAttribute("aria-valuetext");
        expect(text, `${label} announces a bare number`).toBeTruthy();
        expect(text).not.toBe(slider.value);
      }
      expect(byLabel(m, "Lightness")?.getAttribute("aria-valuetext")).toMatch(/%$/);
      expect(byLabel(m, "Hue")?.getAttribute("aria-valuetext")).toMatch(/degrees$/);
      expect(byLabel(m, "Chroma")?.getAttribute("aria-valuetext")).toContain("maximum");
    });

    // The clamp is silent otherwise: chroma keeps climbing past the boundary
    // while the emitted colour stops changing, and a sighted user sees the
    // hatching and the notice where a screen reader user got nothing.
    it(
      "the out-of-gamut notice is a live region that stays put",
      (m) => {
        const notice = m.root.querySelector(".oklch-picker__notice");
        expect(notice, "no notice element").not.toBeNull();
        expect(notice?.getAttribute("role")).toBe("status");
        // Mounted but silent: a region added at the moment it has something to
        // say is not announced, because nothing was watching the node.
        expect(notice?.textContent).toBe("");
      },
      { value: "oklch(0.7 0.05 255)" },
    );

    it(
      "the notice speaks when the colour is clipped",
      (m) => {
        const notice = m.root.querySelector(".oklch-picker__notice");
        expect(notice?.getAttribute("role")).toBe("status");
        expect(notice?.textContent).toContain("Outside sRGB");
      },
      { value: "oklch(0.2 0.3 145)" },
    );

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
      expect(shows(m, ".oklch-picker__recents")).toBe(false);
      expect(m.root.querySelectorAll(".oklch-picker__recent")).toHaveLength(0);
    });

    it(
      "a preset click is committed, and reported to the recents callback",
      async (m) => {
        await m.click(m.root.querySelector(".oklch-picker__preset") as Element);
        expect(m.root.querySelectorAll(".oklch-picker__recent").length).toBeGreaterThan(0);
        // The payload, not just that something happened: a commit carries the
        // whole list, most recent first.
        expect(m.recents.at(-1)).toEqual([PRESETS[0]]);
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
        expect(shows(m, ".oklch-picker__recents")).toBe(false);
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

    it("the oklch field leads, shows the value, and hex is off by default", (m) => {
      const oklch = m.root.querySelector<HTMLInputElement>(".oklch-picker__field--oklch");
      expect(oklch).not.toBeNull();
      expect(oklch?.value).toBe("oklch(0.7 0.15 255)");
      // Hex was the default field in 1.0. It is opt-in now.
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
      "a P3 output keeps a P3 colour whole, unclipped and unremarked",
      async (m) => {
        // Unremarked matters as much as unclipped: a colour inside the output
        // space must not be flagged as out of it.
        expect(shows(m, ".oklch-picker__notice")).toBe(false);
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

    // The press reports and does nothing else, in the six controlled adapters.
    // `gamut` is a prop there, so the app owns it: an adapter that switched its
    // own output would be driving state its consumer thinks it holds, and the
    // next render would put it back.
    //
    // This is the half the test above could not see. It asserted only that a
    // press was *reported*, so an adapter that also re-clamped and emitted a
    // second value passed it just as well as one that did nothing.
    //
    // `vanilla` declares this one `unsupported` and asserts the opposite in its
    // own file, for the same reason the READMEs single it out: the element
    // holds its own colour, so switching gamut is its business rather than the
    // app's. That declaration prints as a skip carrying the reason, so the
    // divergence is stated rather than invisible.
    it(
      "pressing a gamut reports it without emitting a colour",
      async (m) => {
        const before = m.emitted.length;
        const choices = m.root.querySelectorAll(".oklch-picker__gamut-choice");
        await m.click(choices[1] as Element);
        expect(m.gamuts.at(-1)?.id).toBe("p3");
        // The output space is the app's to change, so nothing is emitted
        // until it passes the new `gamut` back in.
        expect(m.emitted.length, "the switcher emitted a colour of its own").toBe(before);
      },
      {
        value: "oklch(0.75 0.2 145)",
        gamutChoices: [SRGB, P3, REC2020],
        parts: { gamutSwitch: true },
      },
    );

    it(
      "one option is not a choice, so sRGB alone renders no switcher",
      (m) => {
        expect(m.root.querySelector(".oklch-picker__gamut-switch")).toBeNull();
      },
      { gamutChoices: [SRGB], parts: { gamutSwitch: true } },
    );

    // ---- gestures --------------------------------------------------------

    it("a drag records once, not once per value", async (m) => {
      const hue = byLabel(m, "Hue") as HTMLInputElement;
      for (const v of ["100", "150", "200", "250", "300"]) await m.set(hue, v);
      // Nothing yet: the gesture is still running, and recording here would
      // bury the list in near-identical colours from one drag.
      expect(m.recents).toHaveLength(0);
      await m.release(hue);
      expect(m.recents).toHaveLength(1);
      expect(m.recents[0]).toHaveLength(1);
    });

    it(
      "the stacked strips are read-only; only the chart layout's plot drags",
      (m) => {
        const charts = m.root.querySelectorAll(".oklch-picker__chart");
        expect(charts).toHaveLength(3);
        // A 34px strip gives a drag almost no vertical travel, and it would set
        // two axes at once right above the slider that sets one precisely.
        for (const c of charts) {
          expect(c.classList.contains("oklch-picker__chart--interactive")).toBe(false);
        }
      },
      { layout: "stacked" },
    );

    it(
      "side-by-side shows the same single interactive plot",
      (m) => {
        const charts = m.root.querySelectorAll(".oklch-picker__chart");
        expect(charts).toHaveLength(1);
        expect(charts[0]?.classList.contains("oklch-picker__chart--interactive")).toBe(true);
      },
      { layout: "side-by-side" },
    );

    // ---- the chart -------------------------------------------------------

    it("dragging the chart emits a clamped colour", async (m) => {
      const chart = m.root.querySelector(".oklch-picker__chart");
      expect(chart).not.toBeNull();
      // Mid-plot: half the lightness range, and whatever chroma that allows.
      await m.drag(chart as Element, 0.5, 0.5);
      expect(m.emitted.length).toBeGreaterThan(0);
      expect(last(m)).toMatch(/^oklch\(/);
    });

    it("a chart drag keeps the hue the slider was already moved to", async (m) => {
      await m.set(byLabel(m, "Hue") as HTMLInputElement, "300");
      await m.drag(m.root.querySelector(".oklch-picker__chart") as Element, 0.5, 0.5);
      // The chart sweeps lightness and chroma, so the hue it was given has to
      // survive the drag rather than being reset by it.
      expect(parseOklch(last(m))?.h).toBeCloseTo(300, 0);
    });

    // ---- alpha -----------------------------------------------------------

    it("the alpha slider emits the transparent form, and drops it at opaque", async (m) => {
      const alpha = byLabel(m, "Alpha") as HTMLInputElement;
      expect(alpha).not.toBeNull();
      await m.set(alpha, "0.5");
      expect(last(m)).toBe("oklch(0.7 0.15 255 / 0.5)");
      // Back to opaque emits the short form, not `/ 1`. One shape for opaque.
      await m.set(alpha, "1");
      expect(last(m)).toBe("oklch(0.7 0.15 255)");
    });

    it(
      "an incoming alpha survives into the field and the slider",
      (m) => {
        const alpha = byLabel(m, "Alpha") as HTMLInputElement;
        expect(alpha?.value).toBe("0.4");
        const field = m.root.querySelector<HTMLInputElement>(".oklch-picker__field--oklch");
        expect(field?.value).toContain("/ 0.4");
      },
      { value: "oklch(0.7 0.15 255 / 0.4)" },
    );

    // ---- notice ----------------------------------------------------------

    it(
      "the out-of-gamut notice can be turned off",
      async (m) => {
        await m.set(byLabel(m, "Chroma") as HTMLInputElement, "0.4");
        expect(shows(m, ".oklch-picker__notice")).toBe(false);
      },
      { parts: { notice: false } },
    );

    it(
      "a per-gamut label words the notice for the output space",
      (m) => {
        // Trimmed: some template languages pad an interpolation with
        // whitespace, which is formatting rather than behaviour.
        expect(m.root.querySelector(".oklch-picker__notice")?.textContent?.trim()).toBe("custom");
      },
      { value: "oklch(0.8 0.35 145)", gamut: P3, labels: { "outOf:p3": "custom" } },
    );

    // ---- text fields -----------------------------------------------------

    it(
      "each format renders when asked for",
      (m) => {
        const rgb = m.root.querySelector<HTMLInputElement>(".oklch-picker__field--rgb");
        const hex = m.root.querySelector<HTMLInputElement>(".oklch-picker__field--hex");
        expect(rgb?.value).toMatch(/^rgb\(/);
        expect(hex?.value).toMatch(/^#/);
      },
      { parts: { rgbInput: true, hexInput: true } },
    );

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
