/**
 * Headless picker logic — the framework-agnostic layer between the colour
 * maths and a component. A new framework adapter should only add markup and
 * state wiring on top of these. Framework-free, no DOM.
 */
import {
  type Axis,
  MAX_CHROMA,
  type Oklch,
  clampToGamut,
  gamutCurve,
  inGamut,
  oklchToHex,
} from "./colour.js";

/** Visual arrangements a picker can take; purely presentational. */
export type PickerLayout = "stacked" | "compact" | "side-by-side";

/** Optional parts of the picker; each renders unless turned off. */
export interface PickerParts {
  charts?: boolean;
  preview?: boolean;
  hexInput?: boolean;
  name?: boolean;
  notice?: boolean;
}

export const DEFAULT_PARTS: Required<PickerParts> = {
  charts: true,
  preview: true,
  hexInput: true,
  name: true,
  notice: true,
};

export const DEFAULT_LABELS: Record<Axis | "outOfGamut", string> = {
  l: "Lightness",
  c: "Chroma",
  h: "Hue",
  outOfGamut: "Outside what a screen can display — the nearest colour is used.",
};

/** The colour at fraction t along one axis, the other axes held. */
export function atPosition(base: Oklch, axis: Axis, t: number, max: number): Oklch {
  if (axis === "l") return { ...base, l: t };
  if (axis === "c") return { ...base, c: t * max };
  return { ...base, h: t * 360 };
}

/** CSS background for a slider track, sampled along the axis. */
export function trackGradient(base: Oklch, axis: Axis, max: number): string {
  const steps = axis === "h" ? 24 : 16;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    stops.push(oklchToHex(clampToGamut(atPosition(base, axis, i / steps, max))));
  }
  return `linear-gradient(to right, ${stops.join(",")})`;
}

export interface Span {
  start: number;
  end: number;
}

/** Every out-of-gamut run, as 0..1 fractions — an axis can be unreachable at both ends. */
export function outOfGamutSpans(base: Oklch, axis: Axis, max: number): Span[] {
  const steps = 64;
  const spans: Span[] = [];
  let run: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bad = !inGamut(atPosition(base, axis, t, max));
    if (bad && run === null) run = t;
    if (!bad && run !== null) {
      spans.push({ start: run, end: t });
      run = null;
    }
  }
  if (run !== null) spans.push({ start: run, end: 1 });
  return spans;
}

export interface AxisModel {
  key: Axis;
  min: number;
  max: number;
  step: number;
  value: number;
}

/** Slider ranges for a colour. Chroma's max hugs what is actually reachable —
 * a fixed max is up to 87% dead travel at low lightness. */
export function axisModels(current: Oklch, reachable: number): AxisModel[] {
  const chromaMax = Math.max(0.02, Math.ceil(reachable * 100) / 100);
  return [
    { key: "l", min: 0, max: 1, step: 0.01, value: current.l },
    { key: "c", min: 0, max: chromaMax, step: 0.005, value: Math.min(current.c, chromaMax) },
    { key: "h", min: 0, max: 360, step: 1, value: current.h },
  ];
}

/** Gamut chart viewBox; the SVG scales to its container. */
export const CHART_W = 100;
export const CHART_H = 34;

export interface GamutChartModel {
  /** The curve as SVG path points ("x,y L x,y ..."), in viewBox units. */
  path: string;
  /** Gradient stops: offset in percent, colour already gamut-clamped. */
  stops: { offset: number; hex: string }[];
}

/** The curve and gradient of one gamut chart, in CHART_W x CHART_H viewBox units. */
export function gamutChartModel(base: Oklch, axis: Axis, resolution = 64): GamutChartModel {
  const cols = gamutCurve(base, axis, resolution);
  // Floor the scale so a flat curve does not blow up to full height.
  const peak = Math.max(...cols.map((c) => c.c));
  const yMax = Math.max(peak, MAX_CHROMA * 0.35);
  const path = cols
    .map((c) => `${(c.t * CHART_W).toFixed(2)},${(CHART_H - (c.c / yMax) * CHART_H).toFixed(2)}`)
    .join(" L");
  return { path, stops: cols.map((c) => ({ offset: c.t * 100, hex: c.hex })) };
}
