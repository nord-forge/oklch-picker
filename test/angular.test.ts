/** The Angular adapter, rendered through Angular's own TestBed.
 *
 * `@angular/compiler` is imported first so templates compile at runtime. The
 * published package ships `ngc` output with the templates already compiled, so
 * this exercises the same component a consumer gets rather than a JIT variant
 * of it.
 */
import "@angular/compiler";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";
import { ColourPickerComponent } from "@oklch-picker/angular";
import { parseOklch } from "@oklch-picker/core";
import { P3 } from "@oklch-picker/core/gamuts";
import { beforeAll, describe, expect, test } from "vitest";

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
});

interface Harness {
  fixture: ComponentFixture<ColourPickerComponent>;
  el: HTMLElement;
  /** Every colour the picker has emitted, in order. */
  emitted: string[];
  latest: () => string;
  set: (props: Record<string, unknown>) => void;
}

function mount(props: Record<string, unknown> = {}): Harness {
  const fixture = TestBed.createComponent(ColourPickerComponent);
  const emitted: string[] = [];
  fixture.componentInstance.valueChange.subscribe((c: string) => {
    emitted.push(c);
    // Controlled, like the other adapters' tests: the emitted value goes back
    // in, so a drag that clamps is read back through `resolveCurrent`.
    fixture.componentRef.setInput("value", c);
  });
  const set = (next: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(next)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  };
  set({ value: "oklch(0.7 0.15 255)", ...props });
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    emitted,
    latest: () => emitted[emitted.length - 1] ?? "",
    set,
  };
}

/** Drive a range input the way a user would, then let Angular settle. */
function slide(h: Harness, index: number, value: number): void {
  const sliders = h.el.querySelectorAll<HTMLInputElement>("input[type=range]");
  const slider = sliders[index];
  if (!slider) throw new Error(`no slider at ${index}`);
  slider.value = String(value);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  h.fixture.detectChanges();
}

describe("ColourPicker (Angular)", () => {
  test("renders one slider per OKLCH axis, plus alpha", () => {
    const h = mount();
    expect(h.el.querySelectorAll("input[type=range]")).toHaveLength(4);
  });

  test("emits a canonical oklch string when a slider moves", () => {
    const h = mount();
    slide(h, 0, 0.5);
    expect(h.latest()).toMatch(/^oklch\(/);
    expect(parseOklch(h.latest())?.l).toBeCloseTo(0.5, 2);
  });

  test("never emits a colour outside the gamut", () => {
    // Same shape as the other adapters: dialling far past what sRGB can show
    // comes back with the chroma reduced, keeping lightness and hue.
    const h = mount({ value: "oklch(0.75 0.2 145)" });
    slide(h, 0, 0.15);
    expect(parseOklch(h.latest())?.c).toBeLessThan(0.2);
  });

  test("dragging through an unreachable region keeps the other axes", () => {
    const h = mount({ value: "oklch(0.7 0.15 255)" });
    slide(h, 1, 0.4);
    slide(h, 2, 300);
    // The hue has to survive a chroma drag that was clamped on the way.
    expect(parseOklch(h.latest())?.h).toBeCloseTo(300, 0);
  });

  test("moving one slider keeps what the others were already dragged to", () => {
    const h = mount();
    slide(h, 0, 0.35);
    expect(parseOklch(h.latest())?.l).toBeCloseTo(0.35, 2);
    slide(h, 2, 300);
    expect(parseOklch(h.latest())?.l).toBeCloseTo(0.35, 2);
    expect(parseOklch(h.latest())?.h).toBeCloseTo(300, 0);
  });

  test("renders presets and selects one on click", () => {
    const h = mount({ presets: ["oklch(0.75 0.16 145)", "oklch(0.5 0.1 30)"] });
    const buttons = h.el.querySelectorAll<HTMLButtonElement>(".oklch-picker__preset");
    expect(buttons).toHaveLength(2);
    buttons[1]?.click();
    h.fixture.detectChanges();
    expect(h.latest()).toBe("oklch(0.5 0.1 30)");
  });

  test("a preset click records a recent colour", () => {
    const h = mount({ presets: ["oklch(0.5 0.1 30)"] });
    h.el.querySelector<HTMLButtonElement>(".oklch-picker__preset")?.click();
    h.fixture.detectChanges();
    expect(h.el.querySelectorAll(".oklch-picker__recent").length).toBeGreaterThan(0);
  });

  test("accepts any supported format in the oklch field", () => {
    const h = mount();
    const field = h.el.querySelector<HTMLInputElement>(".oklch-picker__field--oklch");
    expect(field).not.toBeNull();
    // A hex pasted into the oklch field works, rather than being a rule to learn.
    (field as HTMLInputElement).value = "#3366ff";
    field?.dispatchEvent(new Event("input", { bubbles: true }));
    h.fixture.detectChanges();
    expect(h.latest()).toMatch(/^oklch\(/);
  });

  test("falls back to a usable colour when the value is unparseable", () => {
    const h = mount({ value: "not a colour" });
    expect(h.el.querySelectorAll("input[type=range]")).toHaveLength(4);
  });

  test("parts can be turned off individually", () => {
    const h = mount({ parts: { charts: false, name: false, alpha: false } });
    expect(h.el.querySelector(".oklch-picker__chart")).toBeNull();
    expect(h.el.querySelector(".oklch-picker__name")).toBeNull();
    expect(h.el.querySelectorAll("input[type=range]")).toHaveLength(3);
  });

  test("the hex field is opt-in, and oklch is shown by default", () => {
    const h = mount();
    expect(h.el.querySelector(".oklch-picker__field--oklch")).not.toBeNull();
    expect(h.el.querySelector(".oklch-picker__field--hex")).toBeNull();

    const opted = mount({ parts: { hexInput: true } });
    expect(opted.el.querySelector(".oklch-picker__field--hex")).not.toBeNull();
  });

  test("layouts set a modifier class, and compact drops the charts", () => {
    expect(mount({ layout: "compact" }).el.querySelector(".oklch-picker--compact")).not.toBeNull();
    expect(mount({ layout: "compact" }).el.querySelector(".oklch-picker__chart")).toBeNull();
    expect(mount({ layout: "stacked" }).el.querySelector(".oklch-picker--stacked")).not.toBeNull();
  });

  test("the chart layout shows one plot for all three sliders", () => {
    const h = mount({ layout: "chart" });
    expect(h.el.querySelectorAll(".oklch-picker__chart")).toHaveLength(1);
  });

  test("stacked gives every axis its own chart", () => {
    const h = mount({ layout: "stacked" });
    expect(h.el.querySelectorAll(".oklch-picker__chart")).toHaveLength(3);
  });

  test("labels can be translated", () => {
    const h = mount({ labels: { l: "Helderheid" } });
    expect(h.el.textContent).toContain("Helderheid");
  });

  test("class prefix is applied so styles can be overridden", () => {
    const h = mount({ classPrefix: "brand" });
    expect(h.el.querySelector(".brand")).not.toBeNull();
    expect(h.el.querySelector(".oklch-picker")).toBeNull();
  });

  test("a P3 output reaches further than sRGB would", () => {
    // The same drag clamps harder in sRGB. That the P3 picker keeps more
    // chroma is the whole point of the gamut being the output space.
    const wide = mount({ value: "oklch(0.75 0.25 145)", gamut: P3 });
    slide(wide, 0, 0.75);
    const narrow = mount({ value: "oklch(0.75 0.25 145)" });
    slide(narrow, 0, 0.75);
    const wideC = parseOklch(wide.latest())?.c ?? 0;
    const narrowC = parseOklch(narrow.latest())?.c ?? 0;
    expect(wideC).toBeGreaterThan(narrowC);
  });

  test("two pickers do not share a gradient id", () => {
    const a = mount();
    const b = mount();
    const ids = [a, b].flatMap((h) =>
      [...h.el.querySelectorAll("linearGradient")].map((g) => g.id),
    );
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("alpha rides with the axes and emits a transparent colour", () => {
    const h = mount({ value: "oklch(0.7 0.15 255 / 0.4)" });
    expect(h.el.querySelector(".oklch-picker__alpha")).not.toBeNull();
    slide(h, 3, 0.5);
    expect(h.latest()).toContain("/");
  });
});
