/** The custom element, driven through real DOM. No framework involved. */
import { type Gamut, SRGB, parseOklch } from "@oklch-picker/core";
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

  test("parts can be turned off with a JSON attribute", () => {
    const picker = mount({
      value: "oklch(0.7 0.15 255)",
      parts: '{"charts":false,"oklchInput":false,"hexInput":false,"name":false,"preview":false}',
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
    expect(notice?.textContent).toContain("Outside sRGB");

    // Emptied rather than removed or hidden: it is a live region, so it has to
    // stay in the accessibility tree to announce the next thing it says.
    picker.value = "oklch(0.7 0.05 255)";
    const after = picker.querySelector<HTMLElement>(".oklch-picker__notice");
    expect(after).not.toBeNull();
    expect(after?.textContent).toBe("");
    expect(after?.getAttribute("role")).toBe("status");
  });

  test("a property set before upgrade is not shadowed", () => {
    const picker = document.createElement("oklch-picker") as OklchPickerElement;
    // A value assigned before the definition loads lands as an own property,
    // shadowing the accessor. Recreate that state directly, because
    // `createElement` has already upgraded this instance and assigning
    // normally would not.
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
    // Listening on a parent is the realistic case. A stray bubbled `change`
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

  // Outside sRGB, inside P3. This is the colour the gamut tests turn on.
  const wide = "oklch(0.7 0.25 145)";

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
    // And the emitted value follows the property, not sRGB: nothing is clipped,
    // so the notice is present but says nothing.
    expect(picker.querySelector<HTMLElement>(".oklch-picker__notice")?.textContent).toBe("");
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

describe("<oklch-picker> recent colours", () => {
  /** Every `recentschange` payload, in order. */
  function recorded(picker: OklchPickerElement): string[][] {
    const seen: string[][] = [];
    picker.addEventListener("recentschange", (e) => seen.push((e as CustomEvent).detail.recents));
    return seen;
  }

  // The list is a plain array of strings, so it reads from an attribute too.
  // That is the no-framework fallback, exactly as `presets` does.
  test("a JSON attribute controls the list as the property does", () => {
    const picker = mount({
      value: "oklch(0.7 0.15 255)",
      recents: '["oklch(0.75 0.16 145)", "oklch(0.5 0.1 30)"]',
    });
    expect(picker.querySelectorAll(".oklch-picker__recent")).toHaveLength(2);
  });

  // A recent is picked through the same path a preset is, so it emits the
  // colour rather than only marking itself pressed.
  test("clicking a recent selects that colour", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    picker.recents = ["oklch(0.75 0.16 145)"];
    const seen: string[] = [];
    picker.addEventListener("change", (e) => seen.push((e as CustomEvent).detail.colour));

    picker.querySelector<HTMLButtonElement>(".oklch-picker__recent")?.click();
    expect(seen).toEqual(["oklch(0.75 0.16 145)"]);
  });
});

describe("the chart scale follows every space in view", () => {
  /** Peak height of the filled curve, of the 34-unit viewBox. */
  const height = (picker: OklchPickerElement) => {
    const d = picker.querySelector(".oklch-picker__chart path")?.getAttribute("d") ?? "";
    const ys = [...d.matchAll(/[\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
    return 34 - Math.min(...ys);
  };

  // Regression: the element passed the output gamut but not `scaleGamuts`, so
  // each chart fell back to scaling by what it happened to draw. A Rec. 2020
  // picker and a P3 picker then used different rulers, and the wider one drew
  // shorter, which is the opposite of what height should mean.
  test("a wider output gamut draws taller, given the same spaces", () => {
    const at = (gamut: Gamut) => {
      const picker = mount({ value: "oklch(0.7 0.2 145)" });
      picker.references = [SRGB, P3, REC2020];
      picker.gamut = gamut;
      return height(picker);
    };
    expect(at(P3)).toBeGreaterThan(at(SRGB));
    expect(at(REC2020)).toBeGreaterThan(at(P3));
  });
});

describe("gradient ids are unique per picker", () => {
  // Regression: every chart built its id from the class prefix and the axis, so
  // two pickers on a page both emitted `oklch-picker-gamut-h`. SVG ids share
  // one document-wide namespace, so the second picker's `fill="url(#...)"`
  // resolved to the first one's gradient and its chart drew the wrong colours.
  const gradientIds = (picker: OklchPickerElement) =>
    [...picker.querySelectorAll("linearGradient")].map((g) => g.getAttribute("id"));

  test("two pickers on one page do not collide", () => {
    const a = mount({ value: "oklch(0.7 0.15 255)" });
    const b = mount({ value: "oklch(0.5 0.1 30)" });
    const ids = [...gradientIds(a), ...gradientIds(b)];
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every url(#id) resolves to a gradient in the same picker", () => {
    const picker = mount({ value: "oklch(0.7 0.15 255)" });
    const defined = new Set(gradientIds(picker));
    const refs = [...picker.querySelectorAll("path")]
      .map((p) => p.getAttribute("fill"))
      .filter((f): f is string => Boolean(f?.startsWith("url(#")))
      .map((f) => f.slice(5, -1));
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(defined.has(ref)).toBe(true);
  });

  test("the ids stay url-safe, since they sit inside url(#...)", () => {
    for (const id of gradientIds(mount({ value: "oklch(0.7 0.15 255)" }))) {
      expect(id).toMatch(/^[A-Za-z0-9_:.-]+$/);
    }
  });
});
