/**
 * Headless picker logic — the framework-agnostic layer between the colour
 * maths and a component. A new framework adapter should only add markup and
 * state wiring on top of these. Framework-free, no DOM.
 */
import {
  type Axis,
  CHART_PLANES,
  type Gamut,
  type Oklch,
  SRGB,
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
  /** A control for switching the output gamut. Off by default: most pickers
   * target one space, and offering the choice only makes sense when the app
   * has said which spaces are on offer. */
  gamutSwitch?: boolean;
}

export const DEFAULT_PARTS: Required<PickerParts> = {
  charts: true,
  preview: true,
  hexInput: true,
  name: true,
  notice: true,
  gamutSwitch: false,
};

/** Label keys: the three axes, plus one notice per gamut the colour can land
 * outside of. `outOfGamut` is the fallback used when no wider gamut is
 * configured, or when the colour is outside all of them. */
export type LabelKey = Axis | "outOfGamut" | `outOf:${string}`;

export const DEFAULT_LABELS: Record<Axis | "outOfGamut", string> = {
  l: "Lightness",
  c: "Chroma",
  h: "Hue",
  // Names sRGB rather than "what a screen can display": the picker can target
  // P3, which is also a screen, so the generic phrasing was only true while
  // sRGB was the only option.
  outOfGamut: "Outside sRGB — the nearest sRGB colour is used.",
};

/** Per-gamut notice key, so `labels` can word the message for one output space
 * without touching the others — `{ "outOf:p3": "…" }`. */
export function gamutNoticeKey(gamut: Gamut): `outOf:${string}` {
  return `outOf:${gamut.id}`;
}

/** Default wording for a colour the output gamut cannot show. Every space names
 * itself: once the picker can target P3, "what a screen can display" is no
 * longer true of sRGB alone. */
export function defaultOutOfGamutNotice(gamut: Gamut, fallback: string): string {
  // sRGB defers to `labels.outOfGamut` so a translation or an override of that
  // one key still wins; every other space words itself from its own label.
  if (gamut.id === SRGB.id) return fallback;
  return `Outside ${gamut.label} — the nearest ${gamut.label} colour is used.`;
}

/** The colour at fraction t along one axis, the other axes held. */
export function atPosition(base: Oklch, axis: Axis, t: number, max: number): Oklch {
  if (axis === "l") return { ...base, l: t };
  if (axis === "c") return { ...base, c: t * max };
  return { ...base, h: t * 360 };
}

/** CSS background for a slider track, sampled along the axis. */
export function trackGradient(base: Oklch, axis: Axis, max: number, gamut: Gamut = SRGB): string {
  const steps = axis === "h" ? 24 : 16;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    stops.push(oklchToHex(clampToGamut(atPosition(base, axis, i / steps, max), gamut)));
  }
  return `linear-gradient(to right, ${stops.join(",")})`;
}

export interface Span {
  start: number;
  end: number;
}

/** Every out-of-gamut run, as 0..1 fractions — an axis can be unreachable at both ends. */
export function outOfGamutSpans(base: Oklch, axis: Axis, max: number, gamut: Gamut = SRGB): Span[] {
  const steps = 64;
  const spans: Span[] = [];
  let run: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bad = !inGamut(atPosition(base, axis, t, max), gamut);
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
export function resolveCurrent(
  draft: Oklch | null,
  value: string | null | undefined,
  gamut: Gamut = SRGB,
): Oklch {
  const stored = toOklch(value) ?? FALLBACK;
  if (draft && formatOklch(clampToGamut(draft, gamut)) === formatOklch(stored)) return draft;
  return stored;
}

/** The canonical, gamut-clamped string to emit for a dialled colour. */
export function emitValue(next: Oklch, gamut: Gamut = SRGB): string {
  return formatOklch(clampToGamut(next, gamut));
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
export function chartSlot(current: Oklch, axis: Axis, gamut: Gamut = SRGB): ChartSlot {
  const { x, y } = CHART_PLANES[axis];
  const at = (a: Axis) => Math.min(1, Math.max(0, current[a] / axisMax(a, gamut)));
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
  /** The message to show while clipped, already resolved against `labels` and
   * any wider gamut that contains the colour. Empty when not clipped. */
  notice: string;
  /** The output space: what is clamped, emitted, and measured against. */
  gamut: Gamut;
  /** Spaces drawn as reference outlines but never clamped to. */
  references: Gamut[];
  /** The spaces the switcher offers, in order. Empty when it is off, or when
   * fewer than two were given — one option is not a choice. */
  gamutChoices: Gamut[];
  /** Whether the gamut switcher should render. */
  withGamutSwitch: boolean;
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
  labels: Record<Axis | "outOfGamut", string> & Partial<Record<string, string>>;
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
  labels?: Partial<Record<LabelKey, string>> | undefined;
  /** The output space. Everything follows it: the sliders' reach, what is
   * clamped and emitted, and what the notice measures against. Defaults to
   * sRGB. Import wider spaces from `@oklch-picker/core/gamuts` — omitting this
   * ships none of that code. */
  gamut?: Gamut | undefined;
  /** Extra spaces to outline on the charts without clamping to them. Defaults
   * to sRGB whenever `gamut` is wider, so the safe region stays visible. */
  references?: Gamut[] | undefined;
  /** Spaces the built-in switcher offers, when `parts.gamutSwitch` is on.
   * Defaults to the output gamut plus its references, deduplicated. */
  gamutChoices?: Gamut[] | undefined;
}

/** Derive a whole picker from the current colour. Pure — call it per render. */
export function pickerModel(current: Oklch, options: PickerOptions = {}): PickerModel {
  const labels = { ...DEFAULT_LABELS, ...options.labels } as PickerModel["labels"];
  const parts = { ...DEFAULT_PARTS, ...options.parts };
  const layout = options.layout ?? DEFAULT_LAYOUT;
  // Compact has no room for charts; skip computing them, not just hiding them.
  const withCharts = parts.charts && layout !== "compact";

  // The one space everything agrees on: what the sliders reach, what is
  // clamped and emitted, and what the notice is measured against. Choosing P3
  // here means a P3 colour is emitted rather than flagged and thrown away.
  const gamut = options.gamut ?? SRGB;
  const reachable = maxChroma(current.l, current.h, gamut);
  const axes = axisModels(current, reachable);
  const clipped = !inGamut(current, gamut);

  // Reference spaces are drawn but never clamped to. sRGB earns a line
  // whenever it is not itself the output, so a wider picker still shows where
  // the safe region ends.
  const references = options.references ?? (gamut === SRGB ? [] : [SRGB]);

  const notice = clipped
    ? (labels[gamutNoticeKey(gamut)] ?? defaultOutOfGamutNotice(gamut, labels.outOfGamut))
    : "";

  // Narrowest-first, and deduplicated by id so passing sRGB as both the output
  // and a reference does not offer it twice.
  const offered = options.gamutChoices ?? [...references, gamut];
  const seen = new Set<string>();
  const gamutChoices = offered.filter((g) => !seen.has(g.id) && seen.add(g.id));
  // One option is not a choice, so the control needs at least two.
  const withGamutSwitch = parts.gamutSwitch && gamutChoices.length > 1;

  return {
    current,
    gamut,
    references,
    gamutChoices: withGamutSwitch ? gamutChoices : [],
    withGamutSwitch,
    hex: oklchToHex(current),
    canonical: emitValue(current, gamut),
    clipped,
    notice,
    light: isLight(current),
    name: colourName(emitValue(current, gamut)),
    reachable,
    axes,
    charts: withCharts ? chartAxes(layout).map((axis) => chartSlot(current, axis, gamut)) : [],
    spans: axes.map((a) => outOfGamutSpans(current, a.key, a.max, gamut)),
    gradients: axes.map((a) => trackGradient(current, a.key, a.max, gamut)),
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
  /** One outline per wider gamut, in the order given. Empty unless `gamuts`
   * was passed, so an app that never opts in draws exactly what it did. */
  boundaries: { id: string; path: string }[];
}

/** The curve and gradient of one gamut chart, in CHART_W x CHART_H viewBox
 * units. The curve is plotted on the vertical axis' own scale, not normalised
 * to its peak: the crosshair is positioned on that same scale, so rescaling
 * here would drift the two apart. */
export function gamutChartModel(
  base: Oklch,
  axis: Axis,
  resolution = 64,
  gamuts: Gamut[] = [],
): GamutChartModel {
  const cols = gamutCurve(base, axis, resolution);
  const toPath = (points: { t: number; c: number }[]) =>
    points
      .map((c) => `${(c.t * CHART_W).toFixed(2)},${(CHART_H - c.c * CHART_H).toFixed(2)}`)
      .join(" L");

  // A wider gamut's curve is measured in its own space but must be drawn on
  // this chart's scale, so the outline sits above the filled region rather
  // than being renormalised back onto it. Only a chroma-vertical plane needs
  // that conversion: `gamutCurve` already divides chroma by the chart scale,
  // whereas a lightness-vertical column is a plain 0..1 fraction of an axis
  // that every gamut shares. Anything past the top is clipped to it.
  const rescale = CHART_PLANES[axis].y === "c";
  const boundaries = gamuts.map((g) => ({
    id: g.id,
    path: toPath(
      gamutCurve(base, axis, resolution, g).map((c) => ({
        t: c.t,
        c: rescale ? Math.min(1, c.c) : c.c,
      })),
    ),
  }));

  return {
    path: toPath(cols),
    stops: cols.map((c) => ({ offset: c.t * 100, hex: c.hex })),
    boundaries,
  };
}
