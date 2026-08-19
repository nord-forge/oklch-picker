/** The custom element, driven through real DOM — no framework involved. */
import { SRGB, parseOklch } from "@oklch-picker/core";
import { P3, REC2020 } from "@oklch-picker/core/gamuts";
import { type OklchPickerElement, register } from "oklch-picker";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

beforeAll(() => register());

let host: HTMLElement | null = null;

/** Mount an element with attributes applied before it enters the document,
 * the way server-rendered markup would arrive. */
function mount(attrs: Record<string, string> = {}): OklchPickerElement {
  host = document.createElement("div");
  const picker = document.createElement("oklch-picker");
  for (const [k, v] of Object.entries(attrs)) picker.setAttribute(k, v);
  host.append(picker);
  document.body.append(host);
  return picker;
}

const slider = (el: Element, label: string) =>
  el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);

afterEach(() => {
  host?.remove();
  host = null;
});

describe("<oklch-picker>", () => {
  test("upgrades and renders one slider per axis", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    expect(slider(picker, "Lightness")).not.toBeNull();
    expect(slider(picker, "Chroma")).not.toBeNull();
    expect(slider(picker, "Hue")).not.toBeNull();
  });

  test("emits a change event with a canonical colour when a slider moves", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const hue = slider(picker, "Hue");
    if (!hue) throw new Error("no hue slider");
    hue.value = "120";
    hue.dispatchEvent(new Event("input"));

    expect(seen).toHaveLength(1);
    expect(parseOklch(seen[0] as string)?.h).toBeCloseTo(120, 0);
  });

  test("never emits a colour outside sRGB", () => {
    const picker = mount({ value: "oklch(0.75 0.2 145)" });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const l = slider(picker, "Lightness");
    if (!l) throw new Error("no lightness slider");
    l.value = "0.15";
    l.dispatchEvent(new Event("input"));

    expect(parseOklch(seen.at(-1) as string)?.c).toBeLessThan(0.2);
  });

  test("dragging through an out-of-gamut region keeps the other axes", () => {
    // Hue is preserved even though chroma gets clamped on the way through.
    const picker = mount({ value: "oklch(0.75 0.2 145)" });
    const l = slider(picker, "Lightness");
    const hue = slider(picker, "Hue");
    if (!l || !hue) throw new Error("missing sliders");

    l.value = "0.15";
    l.dispatchEvent(new Event("input"));
    expect(Number(hue.value)).toBeCloseTo(145, 0);

    // Coming back out, the dialled chroma survives rather than staying clamped.
    l.value = "0.75";
    l.dispatchEvent(new Event("input"));
    const chroma = slider(picker, "Chroma");
    expect(Number(chroma?.value)).toBeCloseTo(0.2, 1);
  });

  // Regression: the listeners are bound once for the life of the node, so
  // reading the colour from the build-time model reset every other axis to
  // whatever it held when the picker was built.
  test("moving one slider keeps what the others were already dragged to", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    const l = slider(picker, "Lightness");
    const hue = slider(picker, "Hue");
    const chroma = slider(picker, "Chroma");
    if (!l || !hue || !chroma) throw new Error("missing sliders");

    l.value = "0.35";
    l.dispatchEvent(new Event("input"));
    expect(Number(slider(picker, "Lightness")?.value)).toBeCloseTo(0.35, 2);

    hue.value = "300";
    hue.dispatchEvent(new Event("input"));
    expect(Number(slider(picker, "Lightness")?.value)).toBeCloseTo(0.35, 2);

    chroma.value = "0.05";
    chroma.dispatchEvent(new Event("input"));
    expect(Number(slider(picker, "Lightness")?.value)).toBeCloseTo(0.35, 2);
    expect(Number(slider(picker, "Hue")?.value)).toBeCloseTo(300, 0);
  });

  test("the value property reflects and resets the draft", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    picker.value = "oklch(0.5 0.1 30)";
    expect(picker.getAttribute("value")).toBe("oklch(0.5 0.1 30)");
    expect(Number(slider(picker, "Hue")?.value)).toBeCloseTo(30, 0);
  });

  test("presets render from a JSON attribute and emit on click", () => {
    const picker = mount({
      value: "oklch(0.7 0.15 255)",
      presets: '["oklch(0.75 0.16 145)"]',
    });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const preset = picker.querySelector<HTMLButtonElement>('button[aria-label="Green"]');
    expect(preset).not.toBeNull();
    preset?.click();
    expect(seen).toEqual(["oklch(0.75 0.16 145)"]);
  });

  test("presets also accept a comma-separated attribute", () => {
    const picker = mount({
      value: "oklch(0.7 0.15 255)",
      presets: "oklch(0.75 0.16 145), oklch(0.5 0.1 30)",
    });
    expect(picker.querySelectorAll(".oklch-picker__preset")).toHaveLength(2);
  });

  test("accepts hex in the hex field", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const hex = picker.querySelector<HTMLInputElement>(".oklch-picker__hex");
    if (!hex) throw new Error("no hex input");
    hex.value = "#ff0000";
    hex.dispatchEvent(new Event("input"));

    expect(parseOklch(seen.at(-1) as string)?.h).toBeCloseTo(29.23, 0);
  });

  test("falls back to a usable colour when the value is unparseable", () => {
    const picker = mount({ value: "not-a-colour" });
    expect(slider(picker, "Lightness")).not.toBeNull();
  });

  test("parts can be turned off with a JSON attribute", () => {
    const picker = mount({
      value: "oklch(0.7 0.15 255)",
      parts: '{"charts":false,"hexInput":false,"name":false,"preview":false}',
    });
    expect(picker.querySelector(".oklch-picker__chart")).toBeNull();
    expect(picker.querySelector(".oklch-picker__hex")).toBeNull();
    expect(picker.querySelector(".oklch-picker__name")).toBeNull();
    expect(picker.querySelector(".oklch-picker__footer")).toBeNull();
    expect(slider(picker, "Lightness")).not.toBeNull();
  });

  test("a malformed JSON attribute is ignored rather than thrown", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", parts: "{not json" });
    // Defaults survive: every part still renders.
    expect(picker.querySelector(".oklch-picker__footer")).not.toBeNull();
  });

  test("the out-of-gamut notice shows only when clipped", () => {
    const picker = mount({ value: "oklch(0.2 0.3 145)" });
    const notice = picker.querySelector<HTMLElement>(".oklch-picker__notice");
    expect(notice?.hidden).toBe(false);
    expect(notice?.textContent).toContain("Outside sRGB");

    picker.value = "oklch(0.7 0.05 255)";
    expect(picker.querySelector<HTMLElement>(".oklch-picker__notice")?.hidden).toBe(true);
  });

  test("layout sets a modifier class, and compact drops the charts", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "compact" });
    expect(picker.classList.contains("oklch-picker--compact")).toBe(true);
    expect(picker.querySelector(".oklch-picker__chart")).toBeNull();
    // The full label survives for assistive tech even when abbreviated.
    expect(slider(picker, "Lightness")).not.toBeNull();
  });

  test("the chart layout shows one plot for all three sliders", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "chart" });
    expect(picker.classList.contains("oklch-picker--chart")).toBe(true);
    // One chart, and it sits above the axes rather than inside one of them.
    expect(picker.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
    expect(picker.querySelector(".oklch-picker__axis .oklch-picker__chart")).toBeNull();
    // All three sliders remain.
    expect(picker.querySelectorAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("stacked gives every axis its own chart", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "stacked" });
    expect(picker.querySelectorAll(".oklch-picker__chart")).toHaveLength(3);
  });

  test("no layout attribute means the chart layout", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    expect(picker.classList.contains("oklch-picker--chart")).toBe(true);
    expect(picker.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
  });

  test("side-by-side shows the same single interactive plot", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "side-by-side" });
    const charts = picker.querySelectorAll(".oklch-picker__chart");
    expect(charts).toHaveLength(1);
    expect(charts[0]?.classList.contains("oklch-picker__chart--interactive")).toBe(true);
    // Hoisted above the axes, as in `chart`, not tucked inside one of them.
    expect(picker.querySelector(".oklch-picker__axis .oklch-picker__chart")).toBeNull();
  });

  test("parts.charts drops the chart in the chart layout too", () => {
    const picker = mount({
      value: "oklch(0.7 0.15 255)",
      layout: "chart",
      parts: '{"charts":false}',
    });
    expect(picker.querySelector(".oklch-picker__chart")).toBeNull();
    expect(picker.querySelectorAll(".oklch-picker__slider")).toHaveLength(3);
  });

  test("dragging the chart emits a clamped colour", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "chart" });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const chart = picker.querySelector<SVGSVGElement>(".oklch-picker__chart");
    if (!chart) throw new Error("no chart");
    // happy-dom lays nothing out, so the rect is stubbed to a known box.
    chart.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    chart.setPointerCapture = () => {};
    chart.hasPointerCapture = () => true;

    chart.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true, pointerId: 1 }),
    );

    expect(seen).toHaveLength(1);
    // Mid-plot: half the lightness range, and whatever chroma that allows.
    expect(parseOklch(seen[0] as string)?.l).toBeCloseTo(0.5, 2);
  });

  // Regression, the chart half of the same staleness: the pointer handlers are
  // bound once too, so a build-time colour would drop the dialled hue.
  test("a chart drag keeps the hue the slider was already moved to", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "chart" });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const hue = slider(picker, "Hue");
    if (!hue) throw new Error("no hue slider");
    hue.value = "300";
    hue.dispatchEvent(new Event("input"));

    const chart = picker.querySelector<SVGSVGElement>(".oklch-picker__chart");
    if (!chart) throw new Error("no chart");
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
    expect(parseOklch(seen.at(-1) as string)?.h).toBeCloseTo(300, 0);
  });

  test("the stacked strips are read-only; only the chart layout's plot drags", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "stacked" });
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    const charts = picker.querySelectorAll(".oklch-picker__chart");
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
    expect(seen).toHaveLength(0);

    picker.setAttribute("layout", "chart");
    const plot = picker.querySelector(".oklch-picker__chart");
    expect(plot?.classList.contains("oklch-picker__chart--interactive")).toBe(true);
  });

  test("labels can be translated", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", labels: '{"l":"Helderheid"}' });
    expect(slider(picker, "Helderheid")).not.toBeNull();
  });

  test("class prefix is applied so styles can be overridden", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", "class-prefix": "my-picker" });
    expect(picker.classList.contains("my-picker")).toBe(true);
    expect(picker.querySelector(".my-picker__axis")).not.toBeNull();
  });

  test("a property set before upgrade is not shadowed", () => {
    const picker = document.createElement("oklch-picker") as OklchPickerElement;
    // A value assigned before the definition loads lands as an own property,
    // shadowing the accessor. Recreate that state directly — `createElement`
    // has already upgraded this instance, so assigning normally would not.
    Object.defineProperty(picker, "value", {
      value: "oklch(0.5 0.1 30)",
      writable: true,
      configurable: true,
      enumerable: true,
    });

    host = document.createElement("div");
    host.append(picker);
    document.body.append(host);

    expect(picker.value).toBe("oklch(0.5 0.1 30)");
    expect(Number(slider(picker, "Hue")?.value)).toBeCloseTo(30, 0);
  });

  // Stacked, so all three per-axis curves are on screen to check at once.
  test("the chart curve is reused while its input is unchanged", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)", layout: "stacked" });
    const chart = picker.querySelector(".oklch-picker__chart");
    const area = chart?.querySelector("path");
    const before = area?.getAttribute("d");

    // Chroma never feeds a curve, so every path must be identical afterwards.
    const chroma = slider(picker, "Chroma");
    if (!chroma) throw new Error("no chroma slider");
    chroma.value = "0.05";
    chroma.dispatchEvent(new Event("input"));

    expect(area?.getAttribute("d")).toBe(before);
  });

  test("register is idempotent and leaves the first definition in place", () => {
    expect(() => {
      register();
      register();
    }).not.toThrow();
    expect(customElements.get("oklch-picker")).toBe(customElements.get("oklch-picker"));
  });

  test("only the element's own change escapes, never the inner input's", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    const seen: (string | undefined)[] = [];
    // Listening on a parent is the realistic case — a stray bubbled `change`
    // from the range input carries no detail and would break the handler.
    host?.addEventListener("change", (e) => seen.push((e as CustomEvent).detail?.colour));

    const hue = slider(picker, "Hue");
    if (!hue) throw new Error("no hue slider");
    hue.value = "120";
    // Both, as a browser fires on commit after a drag.
    hue.dispatchEvent(new Event("input", { bubbles: true }));
    hue.dispatchEvent(new Event("change", { bubbles: true }));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe("oklch(0.7 0.15 120)");
  });

  test("exposes name and form for form participation", () => {
    // happy-dom has no ElementInternals, so submission itself is covered by a
    // browser check rather than here; what this pins is that the element still
    // renders and exposes the API where the platform support is missing.
    const form = document.createElement("form");
    host = document.createElement("div");
    const picker = document.createElement("oklch-picker");
    picker.setAttribute("name", "brand");
    picker.setAttribute("value", "oklch(0.7 0.15 255)");
    form.append(picker);
    host.append(form);
    document.body.append(host);

    expect(picker.name).toBe("brand");
    expect(slider(picker, "Lightness")).not.toBeNull();

    // Reset restores the value the server rendered, not the dialled one.
    const hue = slider(picker, "Hue");
    if (!hue) throw new Error("no hue slider");
    hue.value = "120";
    hue.dispatchEvent(new Event("input"));
    expect(picker.value).toBe("oklch(0.7 0.15 120)");

    picker.formResetCallback();
    expect(picker.value).toBe("oklch(0.7 0.15 255)");
  });

  test("moving a slider does not steal focus from it", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    const hue = slider(picker, "Hue");
    if (!hue) throw new Error("no hue slider");
    hue.focus();
    hue.value = "200";
    hue.dispatchEvent(new Event("input"));
    expect(document.activeElement).toBe(hue);
  });

  // Outside sRGB, inside P3 — the colour the gamut tests turn on.
  const wide = "oklch(0.7 0.25 145)";

  test("the sRGB default costs nothing: no boundary, no switcher", () => {
    const picker = mount({ value: wide, parts: '{"gamutSwitch":true}' });
    expect(picker.querySelector(".oklch-picker__gamut-boundary")).toBeNull();
    // One option is not a choice, so asking for the switcher still shows none.
    expect(picker.querySelector(".oklch-picker__gamut-switch")).toBeNull();
  });

  // The whole point of the reshape: choosing P3 emits P3 rather than drawing a
  // P3 outline around a value that was clamped to sRGB anyway. A `Gamut`
  // carries a conversion function, so it arrives as a property.
  test("a P3 output keeps a P3 colour whole, unclipped and unremarked", () => {
    const picker = mount({ value: wide });
    picker.gamut = P3;
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));
    expect(picker.querySelector<HTMLElement>(".oklch-picker__notice")?.hidden).toBe(true);

    const hue = slider(picker, "Hue");
    if (!hue) throw new Error("no hue slider");
    hue.value = "145";
    hue.dispatchEvent(new Event("input"));

    // ~0.25, not the ~0.22 sRGB would have clipped it to.
    expect(parseOklch(seen.at(-1) as string)?.c).toBeCloseTo(0.25, 3);
  });

  test("a P3 output outlines sRGB as a reference", () => {
    const picker = mount({ value: wide });
    picker.gamut = P3;
    const drawn = picker.querySelectorAll(".oklch-picker__gamut-boundary");
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.classList.contains("oklch-picker__gamut-boundary--srgb")).toBe(true);
  });

  test("the switcher offers the references and the output, and applies a press", () => {
    const picker = mount({ value: wide, parts: '{"gamutSwitch":true}' });
    picker.gamut = P3;
    const chosen: string[] = [];
    picker.addEventListener("gamutchange", (e) =>
      chosen.push((e as CustomEvent).detail.gamut.id as string),
    );

    const buttons = Array.from(
      picker.querySelectorAll<HTMLButtonElement>(".oklch-picker__gamut-choice"),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.textContent)).toEqual(["sRGB", "Display P3"]);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");

    buttons[0]?.click();
    expect(chosen).toEqual(["srgb"]);
    // The element owns its state, so the press takes effect rather than only
    // being announced: the stored colour comes back clamped to sRGB.
    expect(picker.gamut).toBe(SRGB);
    expect(parseOklch(picker.value)?.c).toBeCloseTo(0.2202, 3);
  });

  test("a per-gamut label words the notice for the output space", () => {
    const picker = mount({ value: "oklch(0.8 0.35 145)" });
    picker.gamut = P3;
    picker.labels = { "outOf:p3": "custom" };
    expect(picker.querySelector(".oklch-picker__notice")?.textContent).toBe("custom");
  });

  // A property assigned before the element upgrades shadows the accessor, so
  // without #upgradeProperty the boundary would silently never be drawn.
  test("gamut set before upgrade still takes effect", () => {
    host = document.createElement("div");
    const picker = document.createElement("oklch-picker");
    picker.setAttribute("value", wide);
    picker.gamut = P3;
    host.append(picker);
    document.body.append(host);

    expect(picker.gamut).toBe(P3);
    expect(picker.querySelectorAll(".oklch-picker__gamut-boundary")).toHaveLength(1);
    // And the emitted value follows the property, not sRGB.
    expect(picker.querySelector<HTMLElement>(".oklch-picker__notice")?.hidden).toBe(true);
  });

  test("references outline without being clamped to", () => {
    const picker = mount({ value: wide });
    picker.gamut = REC2020;
    picker.references = [SRGB, P3];
    const drawn = Array.from(picker.querySelectorAll(".oklch-picker__gamut-boundary"));
    expect(drawn).toHaveLength(2);
    expect(drawn[0]?.classList.contains("oklch-picker__gamut-boundary--srgb")).toBe(true);
    expect(drawn[1]?.classList.contains("oklch-picker__gamut-boundary--p3")).toBe(true);
  });
});
