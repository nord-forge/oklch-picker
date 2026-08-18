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
  colourName,
  formatOklch,
  gamutCurve,
  inGamut,
  isLight,
  maxChroma,
  oklchToHex,
  toOklch,
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

/** What the picker shows before anything is set — a mid blue. */
export const FALLBACK: Oklch = { l: 0.7, c: 0.13, h: 260 };

/** The colour to show: the draft while it still round-trips to what was
 * emitted, otherwise the stored value. Dragging through an out-of-gamut region
 * clamps what is emitted, and without this the other axes would be destroyed by
 * reading that clamped value back. */
export function resolveCurrent(draft: Oklch | null, value: string | null | undefined): Oklch {
  const stored = toOklch(value) ?? FALLBACK;
  if (draft && formatOklch(clampToGamut(draft)) === formatOklch(stored)) return draft;
  return stored;
}

/** The canonical, gamut-clamped string to emit for a dialled colour. */
export function emitValue(next: Oklch): string {
  return formatOklch(clampToGamut(next));
}

/** The single input a chart's curve depends on, for memoisation. The curve
 * never reads chroma, and only one of the other two axes: the lightness
 * silhouette depends on hue alone, the chroma and hue silhouettes on lightness
 * alone. Keying on that means dragging any other slider reuses the curve. */
export function chartKey(base: Oklch, axis: Axis): number {
  return axis === "l" ? base.h : base.l;
}

/** The base colour a chart's curve is computed from, given its key. */
export function chartBase(key: number, axis: Axis): Oklch {
  return axis === "l" ? { l: 0, c: 0, h: key } : { l: key, c: 0, h: 0 };
}

/** Everything a picker derives from its current colour, in one place, so an
 * adapter only supplies markup and state. */
export interface PickerModel {
  current: Oklch;
  /** Preview swatch colour. */
  hex: string;
  /** The value that would be emitted for `current`. */
  canonical: string;
  /** True when `current` is outside sRGB, so the notice and title apply. */
  clipped: boolean;
  /** Whether the text over the preview swatch should be dark. */
  light: boolean;
  name: string;
  /** Highest chroma reachable at this lightness and hue. */
  reachable: number;
  axes: AxisModel[];
  /** Per-axis chart inputs, empty when charts are not shown. */
  charts: ChartSlot[];
  /** Per-axis hatched runs, aligned with `axes`. */
  spans: Span[][];
  /** Per-axis slider track backgrounds, aligned with `axes`. */
  gradients: string[];
  labels: Record<Axis | "outOfGamut", string>;
  parts: Required<PickerParts>;
  layout: PickerLayout;
  /** Whether charts should render at all — `compact` has no room for them. */
  withCharts: boolean;
  /** True when at least one footer part is on, so the footer renders. */
  withFooter: boolean;
}

export interface ChartSlot {
  axis: Axis;
  /** Memo key: rebuild the curve only when this changes. */
  key: number;
  /** 0..1 along the axis; drives the vertical crosshair. */
  position: number;
  /** 0..1 of chart height; drives the horizontal crosshair. */
  chromaFraction: number;
}

export interface PickerOptions {
  layout?: PickerLayout | undefined;
  parts?: PickerParts | undefined;
  labels?: Partial<Record<Axis | "outOfGamut", string>> | undefined;
}

/** Derive a whole picker from the current colour. Pure — call it per render. */
export function pickerModel(current: Oklch, options: PickerOptions = {}): PickerModel {
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  const parts = { ...DEFAULT_PARTS, ...options.parts };
  const layout = options.layout ?? "stacked";
  // Compact has no room for charts; skip computing them, not just hiding them.
  const withCharts = parts.charts && layout !== "compact";

  const reachable = maxChroma(current.l, current.h);
  const axes = axisModels(current, reachable);

  return {
    current,
    hex: oklchToHex(current),
    canonical: emitValue(current),
    clipped: !inGamut(current),
    light: isLight(current),
    name: colourName(emitValue(current)),
    reachable,
    axes,
    charts: withCharts
      ? axes.map((a) => ({
          axis: a.key,
          key: chartKey(current, a.key),
          // The chroma chart is plotted against hue.
          position: a.key === "l" ? current.l : current.h / 360,
          chromaFraction: current.c / Math.max(reachable, 1e-6),
        }))
      : [],
    spans: axes.map((a) => outOfGamutSpans(current, a.key, a.max)),
    gradients: axes.map((a) => trackGradient(current, a.key, a.max)),
    labels,
    parts,
    layout,
    withCharts,
    withFooter: parts.preview || parts.hexInput || parts.name,
  };
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
