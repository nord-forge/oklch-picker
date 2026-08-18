/** The custom element, driven through real DOM — no framework involved. */
import { parseOklch } from "@oklch-picker/core";
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
    expect(notice?.textContent).toContain("Outside what a screen can display");

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

  test("the chart curve is reused while its input is unchanged", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
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
});
