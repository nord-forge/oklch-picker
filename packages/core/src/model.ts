/**
 * Headless picker logic. This is the framework-agnostic layer between the
 * colour maths and a component. A new framework adapter should only add markup
 * and state wiring on top of these. Framework-free, no DOM.
 */
import {
  type Axis,
  CHART_PLANES,
  type Gamut,
  type Oklch,
  SRGB,
  alphaOf,
  axisMax,
  chartColour,
  clampToGamut,
  colourName,
  formatOklch,
  formatRgb,
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
 * the one plot that shows what the sliders cannot, which is where the gamut
 * actually ends. The alternative is three strips restating what each track
 * already hatches. */
export const DEFAULT_LAYOUT: PickerLayout = "chart";

/** Optional parts of the picker; each renders unless turned off. */
export interface PickerParts {
  charts?: boolean;
  preview?: boolean;
  /** The editable `oklch()` field. On by default in 1.1. OKLCH is what the
   * picker works in and what it emits, so it is the field that should lead. */
  oklchInput?: boolean;
  /** The editable `rgb()` field. Off by default. */
  rgbInput?: boolean;
  /** The editable hex field. Off by default since 1.1, where it used to be on.
   * Hex cannot express what this picker is for: it is sRGB only, so it cannot
   * carry a wide-gamut colour at all. */
  hexInput?: boolean;
  /** The alpha slider. On by default, since OKLCH carries alpha and a picker
   * that silently drops it would lose part of a value passed in. */
  alpha?: boolean;
  /** The dashed outlines of narrower spaces on the chart, with their labels.
   * On by default. Turning them off leaves the chart plain: the output gamut
   * is unchanged, only the reference lines go. */
  gamutLines?: boolean;
  name?: boolean;
  notice?: boolean;
  /** A control for switching the output gamut. Off by default: most pickers
   * target one space, and offering the choice only makes sense when the app
   * has said which spaces are on offer. */
  gamutSwitch?: boolean;
  /** A row of recently committed colours. On by default, but it renders
   * nothing until a colour has actually been committed. */
  recents?: boolean;
}

export const DEFAULT_PARTS: Required<PickerParts> = {
  charts: true,
  preview: true,
  oklchInput: true,
  rgbInput: false,
  hexInput: false,
  alpha: true,
  gamutLines: true,
  name: true,
  notice: true,
  gamutSwitch: false,
  recents: true,
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
  outOfGamut: "Outside sRGB, the nearest sRGB colour is used.",
};

/** Per-gamut notice key, so `labels` can word the message for one output space
 * without touching the others, as in `{ "outOf:p3": "…" }`. */
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
  return `Outside ${gamut.label}, the nearest ${gamut.label} colour is used.`;
}

/** How many recent colours are kept when no limit is given. Enough to be
 * useful, few enough to stay one row beside a preset palette. */
export const DEFAULT_MAX_RECENTS = 8;

/** Add a committed colour to the recents list, most recent first.
 *
 * Pure, so the caller owns the storage. That can be component state for the
 * session, or a backend for something durable. Deduplicated by the canonical
 * string rather than by object identity. Re-picking a colour should move it to
 * the front rather than appear twice, and two dials of the same colour are the
 * same colour however they were reached. */
export function addRecent(recents: string[], colour: string, max = DEFAULT_MAX_RECENTS): string[] {
  if (max <= 0) return [];
  return [colour, ...recents.filter((c) => c !== colour)].slice(0, max);
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

/** Every out-of-gamut run, as 0..1 fractions. An axis can be unreachable at
 * both ends. */
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
  /** What a screen reader should say instead of the raw number.
   *
   * A range input announces its `value`, so lightness read as "0.7" and alpha
   * as "0.85", neither of which carries a unit. Chroma was worse: its maximum
   * is recomputed from the reachable chroma on every render, so "0.13" is 20%
   * of the range at one lightness and 95% at another, and the percentage a
   * reader derives from `min`/`max` moves with it. Naming the maximum is the
   * only way that value means anything. */
  valuetext: string;
}

/** Slider ranges for a colour. Chroma's max hugs what is actually reachable,
 * because a fixed max is up to 87% dead travel at low lightness. */
export function axisModels(current: Oklch, reachable: number): AxisModel[] {
  const chromaMax = Math.max(0.02, Math.ceil(reachable * 100) / 100);
  const chroma = Math.min(current.c, chromaMax);
  return [
    {
      key: "l",
      min: 0,
      max: 1,
      step: 0.01,
      value: current.l,
      valuetext: `${Math.round(current.l * 100)}%`,
    },
    {
      key: "c",
      min: 0,
      max: chromaMax,
      step: 0.005,
      value: chroma,
      valuetext: `${chroma.toFixed(3)} of ${chromaMax.toFixed(2)} maximum`,
    },
    {
      key: "h",
      min: 0,
      max: 360,
      step: 1,
      value: current.h,
      valuetext: `${Math.round(current.h)} degrees`,
    },
  ];
}

/** The alpha slider's own model.
 *
 * Separate from `axisModels` on purpose. Alpha is not a gamut axis, so giving
 * it an `Axis` key would let it reach `gamutCurve`, `chartAxes`, `atPosition`
 * and the clamping, where it means nothing. Adapters render this one after the
 * three and write back to `a`. */
export interface AlphaModel {
  min: number;
  max: number;
  step: number;
  value: number;
  /** The transparent-to-opaque ramp of the current colour. */
  track: string;
  /** As `AxisModel.valuetext`: "0.85" alone says nothing about opacity. */
  valuetext: string;
}

/** The alpha ramp, transparent to the opaque colour.
 *
 * Only the ramp, not the checkerboard behind it. The ramp depends on the
 * current colour so it has to be computed. The board is fixed presentation and
 * lives in the stylesheet as `--okp-alpha-check-*`, where a theme can restyle
 * it without going through the model. */
export function alphaTrack(current: Oklch, gamut: Gamut = SRGB): string {
  const solid = oklchToHex(clampToGamut({ ...current, a: 1 }, gamut));
  return `linear-gradient(to right, transparent, ${solid})`;
}

export function alphaModel(current: Oklch, gamut: Gamut = SRGB): AlphaModel {
  const value = alphaOf(current);
  return {
    min: 0,
    max: 1,
    step: 0.01,
    value,
    track: alphaTrack(current, gamut),
    valuetext: `${Math.round(value * 100)}% opaque`,
  };
}

/** What the picker shows before anything is set. A mid blue. */
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

/** The value to record in recents for a dialled colour, or null to record
 * nothing.
 *
 * A commit that lands outside the gamut records nothing. `emitValue` clamps, so
 * committing it would file the nearest reachable colour under a colour the user
 * never chose, and repeated drags into the same unreachable region would stack
 * near-identical swatches. Recents is a list of colours someone picked and could
 * actually see. */
export function recentValue(next: Oklch, gamut: Gamut = SRGB): string | null {
  return inGamut(next, gamut) ? emitValue(next, gamut) : null;
}

/** The single input a chart's curve depends on, for memoisation. A chart sweeps
 * the two axes it does not control, so its silhouette depends only on the one
 * it holds fixed. Keying on that means dragging either swept axis moves the
 * crosshair over a reused curve and its ~65 gradient stops. */
export function chartKey(base: Oklch, axis: Axis): number {
  return base[axis];
}

/** A list of gamuts as a stable string, for memo dependencies.
 *
 * `pickerModel` derives `references`, `scaleGamuts` and `gamutChoices` with
 * `filter` and spread, so each call returns a fresh array holding the same
 * spaces. A memo comparing those by reference therefore missed every time, and
 * the curve plus its ~65 gradient stops were rebuilt on every pointer move in
 * six of the seven adapters. A gamut is identified by its `id`, so the joined
 * ids say everything a curve depends on and stay equal between renders. */
export function gamutsKey(gamuts: Gamut[]): string {
  return gamuts.map((g) => g.id).join(",");
}

/** Every gamut list this module has handed out, by its ids.
 *
 * `pickerModel` is called per render and derives its lists with `filter`, so
 * without this it returns a new array of the same spaces every time. Handing
 * back the previous instance when the ids match makes the result stable, which
 * is what lets a chart memo hold across a drag. The set of gamut combinations
 * an app uses is tiny and fixed at build time, so this cannot grow unbounded. */
const gamutListCache = new Map<string, Gamut[]>();

/** One shared empty list, for the parts a picker has turned off. A fresh `[]`
 * per call is a new identity, which is the same memo-busting problem in a
 * cheaper disguise.
 *
 * Not frozen: `PickerModel` types these lists as mutable, and freezing would
 * make the shared instance throw where a caller's own array would not. Nothing
 * in the model writes to it. */
const NO_GAMUTS: Gamut[] = [];

/** The same array instance for the same gamuts, so identity comparisons hold.
 *
 * The ids are only the lookup. The cached list is returned only when it holds
 * the very same `Gamut` objects, so a caller passing a custom space that reuses
 * a built-in id gets its own object back rather than ours.
 *
 * `role` keeps the three lists in separate slots. Without it they share a key
 * whenever they hold the same spaces, which is the common case: on the default
 * sRGB picker both `scaleGamuts` and `gamutChoices` are `["srgb"]`, so each
 * call evicted the other's entry and neither was ever stable. */
function stableGamuts(role: string, gamuts: Gamut[]): Gamut[] {
  const key = `${role}:${gamutsKey(gamuts)}`;
  const seen = gamutListCache.get(key);
  if (seen && seen.length === gamuts.length && seen.every((g, i) => g === gamuts[i])) return seen;
  gamutListCache.set(key, gamuts);
  return gamuts;
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
 * alone, one plot of lightness against chroma, reshaped as the hue slider
 * moves. The others give every axis its own. */
export function chartAxes(layout: PickerLayout): Axis[] {
  return withSingleChart(layout) ? ["h"] : ["l", "c", "h"];
}

/** Where the current colour sits in one chart's slice plane, 0..1 on each
 * screen axis with y measured bottom-up. */
export function chartSlot(
  current: Oklch,
  axis: Axis,
  gamut: Gamut = SRGB,
  references: Gamut[] = [],
): ChartSlot {
  const { x, y } = CHART_PLANES[axis];
  // The vertical axis uses the same shared scale the curve is drawn on, or the
  // crosshair drifts off the silhouette as soon as a wider space is outlined.
  // The horizontal axis is lightness or hue, which every gamut shares.
  const scaleY = chartScale(axis, gamut, references);
  const at = (a: Axis, max: number) => Math.min(1, Math.max(0, current[a] / max));
  return {
    axis,
    key: chartKey(current, axis),
    x: at(x, axisMax(x, gamut)),
    y: at(y, scaleY),
  };
}

/** The colour a point in a chart maps to, for click and drag. `x` and `y` are
 * 0..1 across the plot with y bottom-up; the fixed axis is held from `base`.
 *
 * `scale` must be the same vertical scale `chartSlot` reads back on, which is
 * `chartScale` over every space in view. Picking on one scale and positioning
 * the crosshair on another left it aligned at the bottom of the plot and
 * drifting further the higher the pointer went, in proportion to the ratio
 * between the two. */
export function chartPick(
  base: Oklch,
  axis: Axis,
  x: number,
  y: number,
  gamut: Gamut = SRGB,
  references: Gamut[] = [],
): Oklch {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const { x: xAxis, y: yAxis } = CHART_PLANES[axis];
  return {
    ...base,
    [xAxis]: clamp01(x) * axisMax(xAxis, gamut),
    [yAxis]: clamp01(y) * chartScale(axis, gamut, references),
  } as Oklch;
}

/** Everything a picker derives from its current colour, in one place, so an
 * adapter only supplies markup and state. */
export interface PickerModel {
  current: Oklch;
  /** Preview swatch colour. Carries an alpha pair of digits when transparent,
   * so the swatch shows the transparency rather than a lie. */
  hex: string;
  /** The current colour as `rgb()`, for `parts.rgbInput`. */
  rgb: string;
  /** The current colour as `oklch()`, for `parts.oklchInput`. The same string
   * as `canonical`, named for the field it fills. */
  oklch: string;
  /** The alpha slider, when `parts.alpha` is on. Alpha is not a gamut axis, so
   * it sits beside `axes` rather than in it. */
  alpha: AlphaModel;
  /** Whether the alpha slider should render. */
  withAlpha: boolean;
  /** The value that would be emitted for `current`. */
  canonical: string;
  /** True when `current` is outside sRGB, so the notice and title apply. */
  clipped: boolean;
  /** The message to show while clipped, already resolved against `labels` and
   * any wider gamut that contains the colour. Empty when not clipped. */
  notice: string;
  /** The output space: what is clamped, emitted, and measured against. */
  gamut: Gamut;
  /** Spaces drawn as reference outlines but never clamped to. Only those
   * narrower than the output: a line for the output would trace its own
   * boundary, and a wider one would mark colours this picker cannot reach. */
  references: Gamut[];
  /** Every space in view, drawn or not, which is what sets the chart's
   * vertical scale. A wider space that draws no line still widens the scale, so
   * two pickers given the same list stay comparable by height. */
  scaleGamuts: Gamut[];
  /** The spaces the switcher offers, in order. Empty when it is off, or when
   * fewer than two were given, because one option is not a choice. */
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
  /** Whether charts should render at all. `compact` has no room for them. */
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
   * sRGB. Import wider spaces from `@oklch-picker/core/gamuts`. Omitting this
   * ships none of that code. */
  gamut?: Gamut | undefined;
  /** Extra spaces to outline on the charts without clamping to them. Defaults
   * to sRGB whenever `gamut` is wider, so the safe region stays visible. */
  references?: Gamut[] | undefined;
  /** Spaces the built-in switcher offers, when `parts.gamutSwitch` is on.
   * Defaults to the output gamut plus its references, deduplicated. */
  gamutChoices?: Gamut[] | undefined;
}

/** Derive a whole picker from the current colour. Pure, so call it per render. */
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
  //
  // Only spaces narrower than the output are drawn. A line for the output
  // itself would trace its own boundary, and a wider one would sit outside the
  // fill marking colours this picker cannot reach, which says nothing useful
  // about where the safe region ends. Passing a whole list is therefore safe:
  // each picker keeps the ones that apply to it.
  //
  // `gamutChoices` counts as spaces in view. A switcher offering sRGB, P3 and
  // Rec. 2020 puts all three on screen, so on Rec. 2020 the P3 line belongs
  // too, and the scale must not move as the reader switches or the chart
  // renormalises under them and a narrower space can look taller.
  const inView = options.references ?? options.gamutChoices ?? (gamut === SRGB ? [] : [SRGB]);
  const offeredReferences = inView;
  // `gamutLines` removes the drawn lines only. The spaces stay in view for the
  // scale, so turning the lines off does not resize the chart under the reader.
  const references = stableGamuts(
    "references",
    parts.gamutLines
      ? offeredReferences.filter(
          (g) => g.id !== gamut.id && g.chartMaxChroma < gamut.chartMaxChroma,
        )
      : [],
  );

  const notice = clipped
    ? (labels[gamutNoticeKey(gamut)] ?? defaultOutOfGamutNotice(gamut, labels.outOfGamut))
    : "";

  // Narrowest-first, and deduplicated by id so passing sRGB as both the output
  // and a reference does not offer it twice.
  //
  // Built from the unfiltered list, not from `references`. Those are only the
  // spaces narrow enough to draw a line on this chart, so switching *up* from
  // sRGB to P3 would be impossible if the choices came from them.
  const offered = options.gamutChoices ?? [...offeredReferences, gamut];
  const seen = new Set<string>();
  const gamutChoices = stableGamuts(
    "choices",
    offered.filter((g) => !seen.has(g.id) && seen.add(g.id)),
  );
  // One option is not a choice, so the control needs at least two.
  const withGamutSwitch = parts.gamutSwitch && gamutChoices.length > 1;
  // One instance, shared by the returned model and every chart slot: the charts
  // are positioned on this same scale, and a second copy would be a second
  // identity for a memo to miss on.
  const scaleGamuts = stableGamuts("scale", [...offeredReferences, gamut]);

  return {
    current,
    gamut,
    references,
    scaleGamuts,
    gamutChoices: withGamutSwitch ? gamutChoices : NO_GAMUTS,
    withGamutSwitch,
    hex: oklchToHex(current),
    rgb: formatRgb(current, gamut),
    oklch: emitValue(current, gamut),
    alpha: alphaModel(current, gamut),
    withAlpha: parts.alpha,
    canonical: emitValue(current, gamut),
    clipped,
    notice,
    light: isLight(current),
    name: colourName(emitValue(current, gamut)),
    reachable,
    axes,
    charts: withCharts
      ? chartAxes(layout).map((axis) => chartSlot(current, axis, gamut, scaleGamuts))
      : [],
    spans: axes.map((a) => outOfGamutSpans(current, a.key, a.max, gamut)),
    gradients: axes.map((a) => trackGradient(current, a.key, a.max, gamut)),
    labels,
    parts,
    layout,
    withCharts,
    withFooter: parts.preview || parts.oklchInput || parts.rgbInput || parts.hexInput || parts.name,
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
  boundaries: {
    id: string;
    path: string;
    /** The space's name, for a label on the line. */
    label: string;
    /** Where to anchor that label: the line's highest point, in viewBox units,
     * so the text sits on the boundary rather than floating. */
    labelX: number;
    labelY: number;
  }[];
}

/** The transform that draws a label at its CSS pixel size inside a chart whose
 * viewBox is stretched non-uniformly.
 *
 * The chart is CHART_W x CHART_H scaled to fill its container with
 * `preserveAspectRatio: none`, so one user unit is several pixels across and a
 * different number down. Text placed straight into that is huge and squashed.
 * Translating to the anchor and undoing the scale puts the glyphs back at the
 * size the stylesheet asks for. `width` and `height` are the chart's rendered
 * pixel size; before it has been measured, no transform is better than a wrong
 * one, so the label is simply not drawn. */
export function labelTransform(x: number, y: number, width: number, height: number): string | null {
  if (!width || !height) return null;
  return `translate(${x} ${y}) scale(${CHART_W / width} ${CHART_H / height})`;
}

/** The chart's vertical scale: the widest space in view, output or reference.
 *
 * Every space must share one scale or height stops meaning anything. Scaling
 * each to its own peak made Rec. 2020 draw *lower* than P3 despite reaching
 * further, because its curve was divided by a larger number. Taking the widest
 * means a wider gamut genuinely draws taller, at the cost of a Rec. 2020
 * picker using less of the chart's height than an sRGB one does.
 *
 * Only a chroma axis varies by gamut. Lightness and hue are shared, so those
 * planes return the same scale whatever is in view. */
export function chartScale(axis: Axis, gamut: Gamut = SRGB, references: Gamut[] = []): number {
  const y = CHART_PLANES[axis].y;
  return Math.max(...[gamut, ...references].map((g) => axisMax(y, g)));
}

/** The curve and gradient of one gamut chart, in CHART_W x CHART_H viewBox
 * units. Everything drawn here shares `chartScale`, and `chartSlot` positions
 * the crosshair on it too, so the two cannot drift apart. */
export function gamutChartModel(
  base: Oklch,
  axis: Axis,
  resolution = 64,
  gamuts: Gamut[] = [],
  gamut: Gamut = SRGB,
  /** Every space in view, drawn or not. Defaults to what is drawn plus the
   * output, so the scale still works when a caller passes nothing extra. A
   * wider space that draws no line belongs here: it keeps two pickers given the
   * same list comparable by height. */
  scaleGamuts: Gamut[] = [...gamuts, gamut],
): GamutChartModel {
  // The filled region is the *output* gamut, not always sRGB. Leaving this
  // hardcoded drew a P3 picker's silhouette at sRGB's reach, so passing a wider
  // gamut only added a dotted outline while the plot underneath never moved.
  const cols = gamutCurve(base, axis, resolution, gamut);
  const toPath = (points: { t: number; c: number }[]) =>
    points
      .map((c) => `${(c.t * CHART_W).toFixed(2)},${(CHART_H - c.c * CHART_H).toFixed(2)}`)
      .join(" L");

  // Every curve arrives normalised by its own space's peak, so each is
  // multiplied back into absolute chroma and re-divided by the shared scale.
  // Without that, the spaces are plotted against different rulers.
  const rescale = CHART_PLANES[axis].y === "c";
  const scale = chartScale(axis, gamut, scaleGamuts);
  const onScale = (g: Gamut, c: number) =>
    rescale ? Math.min(1, (c * axisMax(CHART_PLANES[axis].y, g)) / scale) : c;

  const boundaries = gamuts.map((g) => {
    const points = gamutCurve(base, axis, resolution, g).map((c) => ({
      t: c.t,
      c: onScale(g, c.c),
    }));
    // Anchor the label at the line's peak. That is where two boundaries are
    // furthest apart, so labels are least likely to collide, and it reads as
    // belonging to the line rather than to the fill under it.
    const peak = points.reduce(
      (a, b) => (b.c > a.c ? b : a),
      points[0] as { t: number; c: number },
    );
    return {
      id: g.id,
      label: g.label,
      path: toPath(points),
      labelX: peak.t * CHART_W,
      labelY: CHART_H - peak.c * CHART_H,
    };
  });

  return {
    // The fill goes onto the shared scale too. It arrives normalised by the
    // output gamut's own peak, which only equals the scale when nothing wider
    // is outlined over it.
    path: toPath(cols.map((c) => ({ t: c.t, c: onScale(gamut, c.c) }))),
    stops: cols.map((c) => ({ offset: c.t * 100, hex: c.hex })),
    boundaries,
  };
}
