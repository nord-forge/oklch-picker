/** Angular against the shared contract, plus what only Angular does. */
import "@angular/compiler";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";
import { ColourPickerComponent } from "@oklch-picker/angular";
import type { Gamut } from "@oklch-picker/core";
import { beforeAll, expect, test } from "vitest";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
});

const fixtures: ComponentFixture<ColourPickerComponent>[] = [];

adapterContract({
  name: "Angular",
  cleanup() {
    for (const f of fixtures.splice(0)) f.destroy();
  },
  mount(props: PickerProps): Mounted {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];

    const fixture = TestBed.createComponent(ColourPickerComponent);
    fixtures.push(fixture);
    fixture.componentInstance.valueChange.subscribe((c: string) => {
      emitted.push(c);
      // Controlled: the emitted value goes back in, so a clamped one is read
      // back through `resolveCurrent`.
      fixture.componentRef.setInput("value", c);
    });
    fixture.componentInstance.recentsChange.subscribe((r: string[]) => recents.push(r));
    fixture.componentInstance.gamutChange.subscribe((g: Gamut) => gamuts.push(g));

    for (const [k, v] of Object.entries(props)) {
      if (v !== undefined) fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();

    // OnPush plus signals means nothing lands until change detection runs, so
    // every driver method flushes rather than trusting the event alone.
    const flush = () => fixture.detectChanges();

    return {
      // The fixture's host element wraps the picker's own root, which is what
      // the contract queries for `.oklch-picker` and its modifiers.
      root: fixture.nativeElement as HTMLElement,
      emitted,
      recents,
      gamuts,
      set(el, value) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        flush();
      },
      click(el) {
        (el as HTMLElement).click();
        flush();
      },
      drag(el, x, y) {
        // happy-dom lays nothing out, so the chart has no size and a pick would
        // divide by zero.
        const svg = el as SVGSVGElement;
        svg.getBoundingClientRect = () =>
          ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
        svg.setPointerCapture = () => {};
        svg.hasPointerCapture = () => true;
        el.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: x * 200,
            clientY: 100 - y * 100,
          }),
        );
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
        flush();
      },
      blur(el) {
        el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
        flush();
      },
      release(el) {
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
        flush();
      },
    };
  },
});

test("it is standalone, so it needs no NgModule", () => {
  const fixture = TestBed.createComponent(ColourPickerComponent);
  fixture.componentRef.setInput("value", "oklch(0.7 0.15 255)");
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll("input[type=range]")).toHaveLength(4);
  fixture.destroy();
});

test("two pickers do not share a gradient id", () => {
  // SVG gradient ids share a document-wide namespace, so two pickers both
  // emitting `oklch-picker-gamut-h` made the second chart fill from the
  // first one's gradient.
  const a = TestBed.createComponent(ColourPickerComponent);
  a.componentRef.setInput("value", "oklch(0.7 0.15 255)");
  a.detectChanges();
  const b = TestBed.createComponent(ColourPickerComponent);
  b.componentRef.setInput("value", "oklch(0.5 0.1 30)");
  b.detectChanges();

  const ids = [a, b].flatMap((f) =>
    [...(f.nativeElement as HTMLElement).querySelectorAll("linearGradient")].map((g) => g.id),
  );
  expect(ids.length).toBeGreaterThan(1);
  expect(new Set(ids).size).toBe(ids.length);
  a.destroy();
  b.destroy();
});
