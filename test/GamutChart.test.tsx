/** Rendered with Preact via the compat alias, like the picker's own tests. */
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { GamutChart } from "../packages/react/src/GamutChart.js";

afterEach(cleanup);

const BASE = { l: 0.7, c: 0.15, h: 255 };

function svg(container: Element) {
  return container.querySelector("svg") as SVGSVGElement;
}

describe("GamutChart", () => {
  test("renders a filled silhouette and an outline", () => {
    const { container } = render(
      <GamutChart base={BASE} axis="l" id="l" x={0.7} y={0.5} classPrefix="oklch-picker" />,
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    // The fill closes along the bottom; the outline does not.
    expect(paths[0]?.getAttribute("d")).toMatch(/Z$/);
    expect(paths[1]?.getAttribute("d")).not.toMatch(/Z$/);
  });

  test("is hidden from assistive tech, because it duplicates the slider", () => {
    const { container } = render(
      <GamutChart base={BASE} axis="l" id="l" x={0.5} y={0.5} classPrefix="oklch-picker" />,
    );
    expect(svg(container).getAttribute("aria-hidden")).toBe("true");
  });

  test("gradient id is namespaced per instance so two charts cannot collide", () => {
    const { container } = render(
      <>
        <GamutChart base={BASE} axis="l" id="l" x={0.5} y={0.5} classPrefix="oklch-picker" />
        <GamutChart base={BASE} axis="h" id="h" x={0.5} y={0.5} classPrefix="oklch-picker" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  test("crosshairs follow the point in the slice plane", () => {
    const { container } = render(
      <GamutChart base={BASE} axis="l" id="l" x={0.25} y={0} classPrefix="oklch-picker" />,
    );
    const lines = container.querySelectorAll("line");
    // Vertical crosshair sits a quarter along a 100-unit viewBox.
    expect(Number(lines[0]?.getAttribute("x1"))).toBeCloseTo(25, 5);
    // Zero chroma puts the horizontal crosshair on the baseline (height 34).
    expect(Number(lines[1]?.getAttribute("y1"))).toBeCloseTo(34, 5);
  });

  test("clamps an out-of-range y instead of drawing off-canvas", () => {
    const { container } = render(
      <GamutChart base={BASE} axis="l" id="l" x={0.5} y={5} classPrefix="oklch-picker" />,
    );
    const y = Number(container.querySelectorAll("line")[1]?.getAttribute("y1"));
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(34);
  });

  test("honours the class prefix", () => {
    const { container } = render(
      <GamutChart base={BASE} axis="l" id="l" x={0.5} y={0.5} classPrefix="custom" />,
    );
    expect(container.querySelector(".custom__chart")).not.toBeNull();
  });

  test("resolution controls how many gradient stops are emitted", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        x={0.5}
        y={0.5}
        classPrefix="oklch-picker"
        resolution={8}
      />,
    );
    expect(container.querySelectorAll("stop")).toHaveLength(9); // inclusive of both ends
  });

  test("is inert without onPick, and marked interactive with it", () => {
    const plain = render(
      <GamutChart base={BASE} axis="l" id="l" x={0.5} y={0.5} classPrefix="oklch-picker" />,
    );
    expect(svg(plain.container).classList.contains("oklch-picker__chart--interactive")).toBe(false);
    cleanup();

    const live = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        x={0.5}
        y={0.5}
        onPick={() => {}}
        classPrefix="oklch-picker"
      />,
    );
    expect(svg(live.container).classList.contains("oklch-picker__chart--interactive")).toBe(true);
  });

  test("a drag reports plot coordinates, with y measured bottom-up", () => {
    const picks: [number, number][] = [];
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="h"
        id="h"
        x={0.5}
        y={0.5}
        onPick={(x, y) => picks.push([x, y])}
        classPrefix="oklch-picker"
      />,
    );
    const el = svg(container);
    // happy-dom lays nothing out, so the rect is stubbed to a known box.
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    el.setPointerCapture = () => {};
    el.hasPointerCapture = () => true;

    el.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 50, clientY: 25, bubbles: true, pointerId: 1 }),
    );
    // A quarter across, and three quarters up from the bottom edge.
    expect(picks[0]?.[0]).toBeCloseTo(0.25, 5);
    expect(picks[0]?.[1]).toBeCloseTo(0.75, 5);

    el.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 150, clientY: 90, bubbles: true, pointerId: 1 }),
    );
    expect(picks).toHaveLength(2);
    expect(picks[1]?.[0]).toBeCloseTo(0.75, 5);
    expect(picks[1]?.[1]).toBeCloseTo(0.1, 5);
  });

  test("ignores a move that is not part of a captured drag", () => {
    const picks: [number, number][] = [];
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="h"
        id="h"
        x={0.5}
        y={0.5}
        onPick={(x, y) => picks.push([x, y])}
        classPrefix="oklch-picker"
      />,
    );
    const el = svg(container);
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    el.hasPointerCapture = () => false;

    el.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 50, clientY: 25, bubbles: true, pointerId: 1 }),
    );
    expect(picks).toHaveLength(0);
  });
});
