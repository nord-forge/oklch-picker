/** Rendered with Preact via the compat alias, like the picker's own tests. */
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { GamutChart } from "../src/GamutChart.js";

afterEach(cleanup);

const BASE = { l: 0.7, c: 0.15, h: 255 };

function svg(container: Element) {
  return container.querySelector("svg") as SVGSVGElement;
}

describe("GamutChart", () => {
  test("renders a filled silhouette and an outline", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        position={0.7}
        chromaFraction={0.5}
        classPrefix="oklch-picker"
      />,
    );
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    // The fill closes along the bottom; the outline does not.
    expect(paths[0]?.getAttribute("d")).toMatch(/Z$/);
    expect(paths[1]?.getAttribute("d")).not.toMatch(/Z$/);
  });

  test("is hidden from assistive tech — it duplicates the slider", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        position={0.5}
        chromaFraction={0.5}
        classPrefix="oklch-picker"
      />,
    );
    expect(svg(container).getAttribute("aria-hidden")).toBe("true");
  });

  test("gradient id is namespaced per instance so two charts cannot collide", () => {
    const { container } = render(
      <>
        <GamutChart
          base={BASE}
          axis="l"
          id="l"
          position={0.5}
          chromaFraction={0.5}
          classPrefix="oklch-picker"
        />
        <GamutChart
          base={BASE}
          axis="h"
          id="h"
          position={0.5}
          chromaFraction={0.5}
          classPrefix="oklch-picker"
        />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  test("crosshairs follow position and chroma", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        position={0.25}
        chromaFraction={0}
        classPrefix="oklch-picker"
      />,
    );
    const lines = container.querySelectorAll("line");
    // Vertical crosshair sits a quarter along a 100-unit viewBox.
    expect(Number(lines[0]?.getAttribute("x1"))).toBeCloseTo(25, 5);
    // Zero chroma puts the horizontal crosshair on the baseline (height 34).
    expect(Number(lines[1]?.getAttribute("y1"))).toBeCloseTo(34, 5);
  });

  test("clamps an out-of-range chromaFraction instead of drawing off-canvas", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        position={0.5}
        chromaFraction={5}
        classPrefix="oklch-picker"
      />,
    );
    const y = Number(container.querySelectorAll("line")[1]?.getAttribute("y1"));
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(34);
  });

  test("honours the class prefix", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        position={0.5}
        chromaFraction={0.5}
        classPrefix="custom"
      />,
    );
    expect(container.querySelector(".custom__chart")).not.toBeNull();
  });

  test("resolution controls how many gradient stops are emitted", () => {
    const { container } = render(
      <GamutChart
        base={BASE}
        axis="l"
        id="l"
        position={0.5}
        chromaFraction={0.5}
        classPrefix="oklch-picker"
        resolution={8}
      />,
    );
    expect(container.querySelectorAll("stop")).toHaveLength(9); // inclusive of both ends
  });
});
