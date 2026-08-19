/**
 * Headless picker logic — the framework-agnostic layer between the colour
 * maths and a component. A new framework adapter should only add markup and
 * state wiring on top of these. Framework-free, no DOM.
 */
import {
  type Axis,
  CHART_PLANES,
  type Oklch,
  axisMax,
  chartColour,
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
export type PickerLayout = "stacked" | "compact" | "side-by-side" | "chart";

/** The arrangement a picker takes when none is asked for. `chart` leads with
 * the one plot that shows what the sliders cannot — where the gamut actually
 * ends — rather than three strips restating what each track already hatches. */
export const DEFAULT_LAYOUT: PickerLayout = "chart";

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

/** The single input a chart's curve depends on, for memoisation. A chart sweeps
 * the two axes it does not control, so its silhouette depends only on the one
 * it holds fixed. Keying on that means dragging either swept axis moves the
 * crosshair over a reused curve and its ~65 gradient stops. */
export function chartKey(base: Oklch, axis: Axis): number {
  return base[axis];
}

/** The base colour a chart's curve is computed from, given its key. The two
 * swept axes are supplied per column, so only the fixed one matters here. */
export function chartBase(key: number, axis: Axis): Oklch {
  return { l: 0, c: 0, h: 0, [axis]: key } as Oklch;
}

/** Whether a layout leads with one large plot rather than a strip per axis.
 * `side-by-side` has the width to carry it and the room beside it for the
 * readout, so it shows the same single chart `chart` does. */
export function withSingleChart(layout: PickerLayout): boolean {
  return layout === "chart" || layout === "side-by-side";
}

/** Which charts a layout renders. The single-chart layouts show the hue slice
 * alone — one plot of lightness against chroma, reshaped as the hue slider
 * moves — where the others give every axis its own. */
export function chartAxes(layout: PickerLayout): Axis[] {
  return withSingleChart(layout) ? ["h"] : ["l", "c", "h"];
}

/** Where the current colour sits in one chart's slice plane, 0..1 on each
 * screen axis with y measured bottom-up. */
export function chartSlot(current: Oklch, axis: Axis): ChartSlot {
  const { x, y } = CHART_PLANES[axis];
  const at = (a: Axis) => Math.min(1, Math.max(0, current[a] / axisMax(a)));
  return { axis, key: chartKey(current, axis), x: at(x), y: at(y) };
}

/** The colour a point in a chart maps to, for click and drag. `x` and `y` are
 * 0..1 across the plot with y bottom-up; the fixed axis is held from `base`. */
export function chartPick(base: Oklch, axis: Axis, x: number, y: number): Oklch {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return chartColour(base, axis, clamp01(x), clamp01(y));
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
  /** The axis this chart holds fixed; it sweeps the other two. */
  axis: Axis;
  /** Memo key: rebuild the curve only when this changes. */
  key: number;
  /** 0..1 across the plot; drives the vertical crosshair. */
  x: number;
  /** 0..1 up the plot, measured bottom-up; drives the horizontal crosshair. */
  y: number;
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
  const layout = options.layout ?? DEFAULT_LAYOUT;
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
    charts: withCharts ? chartAxes(layout).map((axis) => chartSlot(current, axis)) : [],
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

/** The curve and gradient of one gamut chart, in CHART_W x CHART_H viewBox
 * units. The curve is plotted on the vertical axis' own scale, not normalised
 * to its peak: the crosshair is positioned on that same scale, so rescaling
 * here would drift the two apart. */
export function gamutChartModel(base: Oklch, axis: Axis, resolution = 64): GamutChartModel {
  const cols = gamutCurve(base, axis, resolution);
  const path = cols
    .map((c) => `${(c.t * CHART_W).toFixed(2)},${(CHART_H - c.c * CHART_H).toFixed(2)}`)
    .join(" L");
  return { path, stops: cols.map((c) => ({ offset: c.t * 100, hex: c.hex })) };
}
