/**
 * OKLCH colour maths. Framework-free, no DOM.
 *
 * OKLCH can express colours sRGB cannot show, so everything here round-trips
 * through sRGB and reports whether a colour actually fits.
 * Conversions follow the CSS Color 4 sRGB <-> OKLab matrices.
 */

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.4 in sRGB
  h: number; // 0..360 degrees
  /** 0..1, opaque when absent. Optional rather than defaulted so an opaque
   * colour stays the three-part `oklch(L C H)` it has always been, and so
   * every existing `{ l, c, h }` literal is still a valid Oklch. */
  a?: number;
}

/** The three gamut axes. Alpha is deliberately not one of them: it does not
 * move a colour in or out of gamut, so it must stay clear of the chart maths,
 * the clamping, and the reachable-chroma search. It is carried alongside. */
export type Axis = "l" | "c" | "h";

/** Chroma high enough that no sRGB colour reaches it. This is the bisection's
 * upper bound, deliberately past the real peak so the search always brackets
 * it. */
export const MAX_CHROMA = 0.37;

/** The highest chroma sRGB actually reaches, at any lightness and hue (~0.321
 * around h=328, l=0.7), rounded up to a round number.
 *
 * This is the charts' vertical scale rather than `MAX_CHROMA`: scaling to the
 * bisection bound left the top 13% of every chart permanently unreachable. A
 * hue like teal, whose own peak is ~0.15, used under half the height. A wider
 * gamut would raise this, which is the one number to change.
 *
 * One scale for every hue, deliberately. A hue below the peak leaves the top of
 * its chart empty, and green at ~0.27 leaves about 18%. That empty band is the
 * point: the vertical axis means absolute chroma, so a green slice reaching
 * less far than a magenta one is a fact the chart should show. Rescaling per
 * hue would fill the frame at every hue, but the axis would then mean something
 * different at each one, the plot would breathe under a hue drag, and two hues
 * could no longer be compared. */
export const CHART_MAX_CHROMA = 0.33;

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (n: number, dp: number) => Number(n.toFixed(dp));

/** Parse `oklch(L C H)` or `oklch(L C H / A)`, returning null otherwise.
 *
 * Alpha accepts a fraction or a percentage, matching CSS. It is omitted from
 * the result when it is 1, so an opaque colour parses to the same three-key
 * object it always did and nothing downstream has to special-case it. */
export function parseOklch(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  const m = value.match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/i,
  );
  if (!m) return null;
  const [l, c, h] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (![l, c, h].every(Number.isFinite)) return null;

  if (m[4] === undefined) return { l, c, h };
  const raw = Number(m[4]);
  if (!Number.isFinite(raw)) return null;
  const a = clamp(m[5] === "%" ? raw / 100 : raw, 0, 1);
  return a >= 1 ? { l, c, h } : { l, c, h, a };
}

/** Format as the `oklch(L C H)` string the API stores, or `oklch(L C H / A)`
 * when the colour is not opaque.
 *
 * An opaque colour keeps the short form. Emitting `/ 1` on every value would
 * change what every existing app stores for no gain. */
export function formatOklch(colour: Oklch): string {
  const { l, c, h } = colour;
  const base = `${round(l, 4)} ${round(c, 4)} ${round(((h % 360) + 360) % 360, 2)}`;
  return hasAlpha(colour) ? `oklch(${base} / ${round(colour.a, 4)})` : `oklch(${base})`;
}

/** Whether a colour carries meaningful transparency. One place to ask, so
 * "undefined means opaque" is not re-derived at every call site. */
export function hasAlpha(colour: Oklch): colour is Oklch & { a: number } {
  return colour.a !== undefined && colour.a < 1;
}

/** Alpha as a number, treating absent as opaque. */
export function alphaOf(colour: Oklch): number {
  return colour.a === undefined ? 1 : clamp(colour.a, 0, 1);
}

/** OKLCH -> LMS cubes, the half of the transform every gamut shares. */
export function oklchToLms({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);

  return [
    (l + 0.3963377774 * A + 0.2158037573 * B) ** 3,
    (l - 0.1055613458 * A - 0.0638541728 * B) ** 3,
    (l - 0.0894841775 * A - 1.291485548 * B) ** 3,
  ];
}

/** A colour space the picker can test against and draw a boundary for.
 *
 * Only sRGB ships with the core. Wider gamuts live in `@oklch-picker/core/
 * gamuts` as plain data, so an app that never imports them never pays for
 * them. The bundler drops the module statically, with no dynamic import and
 * no async boundary in the render path. */
export interface Gamut {
  /** Stable id, used for the CSS class on its boundary line. */
  id: string;
  /** Shown in the out-of-gamut notice. */
  label: string;
  /** LMS cubes -> that space's linear channels. */
  fromLms: (lms: [number, number, number]) => [number, number, number];
  /** Chroma this space cannot reach, as the bisection's upper bound. Must sit
   * above the space's true peak or the boundary is silently clipped. Rec. 2020
   * reaches ~0.464, well past what sRGB needs. */
  maxChroma: number;
  /** Chart scale: the space's own reachable peak, rounded up. */
  chartMaxChroma: number;
}

function lmsToLinearSrgb([l_, m_, s_]: [number, number, number]): [number, number, number] {
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** OKLCH -> linear sRGB channels (may fall outside 0..1 when out of gamut). */
function oklchToLinearRgb(colour: Oklch): [number, number, number] {
  return lmsToLinearSrgb(oklchToLms(colour));
}

/** What the picker clamps to. sRGB is the only gamut bundled by default. */
export const SRGB: Gamut = {
  id: "srgb",
  label: "sRGB",
  fromLms: lmsToLinearSrgb,
  maxChroma: MAX_CHROMA,
  chartMaxChroma: CHART_MAX_CHROMA,
};

/** True when the colour is representable in sRGB (within a small tolerance).
 *
 * The tolerance is applied to the *encoded* channel, not the linear one. A
 * linear epsilon is wildly asymmetric. 0.0005 of linear light is about 1.6/255
 * near black but only 0.06/255 near white, so it used to admit a band of
 * unrepresentable near-black colours. An encoded epsilon means the same thing
 * at both ends: a tenth of an 8-bit step, enough to absorb bisection error
 * without letting a visibly different colour through.
 *
 * Fitting inside the cube is necessary but not sufficient. Near black the cube
 * still holds chroma that quantises away. At L=0 every chroma below ~0.039 is
 * `#000000`, indistinguishable from the achromatic colour. Requiring a
 * distinguishable channel is what makes the gamut close to a point at black
 * rather than reporting a width that no screen can show.
 *
 * That separation is measured unrounded, against half a step, rather than by
 * rounding both sides and comparing. Rounding first is not monotonic in chroma:
 * two channels land either side of a `.5` boundary and membership flickers
 * in, out and back in as chroma rises. `bisectChroma` assumes one crossing, so
 * on a flickering predicate it converged inside a dead zone and reported a
 * maximum below what `inGamut` itself accepted. The two disagreed at 2 of the
 * 43,200 (lightness, hue) pairs swept; measuring before the rounding leaves 0,
 * and it means the same thing: at least one channel differs by enough to
 * survive quantisation. */
export function inGamut(colour: Oklch, gamut: Gamut = SRGB): boolean {
  const eps = 0.1 / 255;
  const rgb = gamut.fromLms(oklchToLms(colour));
  if (!rgb.every((v) => linearToSrgb(v) >= -eps && linearToSrgb(v) <= 1 + eps)) return false;
  if (colour.c === 0) return true;

  // Distinguishable from grey at the same lightness once quantised to 8 bits?
  const to255 = (v: number) => clamp(linearToSrgb(v), 0, 1) * 255;
  const grey = gamut.fromLms(oklchToLms({ ...colour, c: 0 })).map(to255);
  return rgb.map(to255).some((v, i) => Math.abs(v - (grey[i] as number)) >= 0.5);
}

/** Highest chroma <= hi that fits the gamut at this lightness and hue. Chroma
 * is monotonic for gamut membership at fixed L and H, so bisect. */
function bisectChroma(l: number, h: number, upper: number, gamut: Gamut = SRGB): number {
  let lo = 0;
  let hi = upper;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h }, gamut)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Reduce chroma until the colour fits the gamut, keeping lightness and hue.
 *
 * The bisection resolves ~100x finer than the four decimals `formatOklch`
 * keeps, so its result lands just inside the boundary and rounding to four
 * places would round half up and cross back out. Floor to that precision here
 * instead: what is returned is then the same colour the formatted string
 * parses back to, and "nothing out-of-gamut is ever emitted" holds for the
 * string as well as the object. */
export function clampToGamut(colour: Oklch, gamut: Gamut = SRGB): Oklch {
  // Negative chroma has no meaning, and the bisection would carry the sign
  // through and emit it. Not reachable from the UI, where the slider stops at 0
  // and a chart pick is clamped to 0..1, but this is a public function and a
  // consumer can write straight into `value`.
  if (colour.c < 0) return { ...colour, c: 0 };
  if (inGamut(colour, gamut)) return colour;
  const c = bisectChroma(colour.l, colour.h, colour.c, gamut);
  const floored = Math.floor(c * 1e4) / 1e4;
  // Membership is not strictly monotonic in chroma: the 8-bit distinguishability
  // rule in `inGamut` can leave an island narrower than this grid, and near
  // white one is thinner than 0.0001. Flooring off such an island would emit a
  // colour that is out of gamut again, so fall back to the achromatic value,
  // which every gamut holds at any lightness.
  return { ...colour, c: inGamut({ ...colour, c: floored }, gamut) ? floored : 0 };
}

/** OKLCH -> `#rrggbb`. Out-of-gamut colours are clamped first. */
export function oklchToHex(colour: Oklch): string {
  const [r, g, b] = oklchToLinearRgb(clampToGamut(colour));
  const to255 = (v: number) =>
    clamp(Math.round(linearToSrgb(v) * 255), 0, 255)
      .toString(16)
      .padStart(2, "0");
  const base = `#${to255(r)}${to255(g)}${to255(b)}`;
  // Eight digits only when there is transparency to carry. An opaque colour
  // keeps the six-digit form every existing consumer expects.
  if (!hasAlpha(colour)) return base;
  const alpha = clamp(Math.round(colour.a * 255), 0, 255)
    .toString(16)
    .padStart(2, "0");
  return `${base}${alpha}`;
}

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` to OKLCH. Null for anything else. */
export function hexToOklch(hex: string): Oklch | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  const raw = m[1] as string;
  const expanded = raw.length <= 4 ? raw.replace(/./g, "$&$&") : raw;
  const full = expanded.slice(0, 6);
  // Present only in the 4 and 8 digit forms.
  const alphaHex = expanded.length === 8 ? expanded.slice(6, 8) : undefined;
  const [r, g, b] = [0, 2, 4].map((i) =>
    srgbToLinear(Number.parseInt(full.slice(i, i + 2), 16) / 255),
  ) as [number, number, number];

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  // A greyscale colour has no meaningful hue; report 0 rather than atan2 noise.
  const colour: Oklch = { l: L, c, h: c < 1e-6 ? 0 : h };

  if (alphaHex === undefined) return colour;
  const a = Number.parseInt(alphaHex, 16) / 255;
  return a >= 1 ? colour : { ...colour, a };
}

/** The 0..255 sRGB channels for a colour, gamut-clamped. The shared step
 * behind both the `rgb()` string and the hex one. */
export function oklchToRgb255(colour: Oklch, gamut: Gamut = SRGB): [number, number, number] {
  const [r, g, b] = oklchToLinearRgb(clampToGamut(colour, gamut));
  const to255 = (v: number) => clamp(Math.round(linearToSrgb(v) * 255), 0, 255);
  return [to255(r), to255(g), to255(b)];
}

/** Format as `rgb(R G B)`, or `rgb(R G B / A)` when not opaque.
 *
 * The space-separated CSS Color 4 form rather than legacy `rgba(...)` commas.
 * Both are valid CSS and every target browser parses this one, since a browser
 * without it would not support `oklch()` either. */
export function formatRgb(colour: Oklch, gamut: Gamut = SRGB): string {
  const [r, g, b] = oklchToRgb255(colour, gamut);
  const base = `${r} ${g} ${b}`;
  return hasAlpha(colour) ? `rgb(${base} / ${round(colour.a, 4)})` : `rgb(${base})`;
}

/** Parse `rgb()` or `rgba()`, in either the comma or the space form, with an
 * optional alpha. Channels accept 0..255 or percentages. */
export function parseRgb(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  const m = value
    .trim()
    .match(
      /^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/i,
    );
  if (!m) return null;

  const channel = (raw: string | undefined, pct: string | undefined) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return Number.NaN;
    return clamp(pct === "%" ? (n / 100) * 255 : n, 0, 255);
  };
  const r = channel(m[1], m[2]);
  const g = channel(m[3], m[4]);
  const b = channel(m[5], m[6]);
  if (![r, g, b].every(Number.isFinite)) return null;

  const hex = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  const colour = hexToOklch(hex);
  if (!colour) return null;

  if (m[7] === undefined) return colour;
  const rawAlpha = Number(m[7]);
  if (!Number.isFinite(rawAlpha)) return null;
  const a = clamp(m[8] === "%" ? rawAlpha / 100 : rawAlpha, 0, 1);
  return a >= 1 ? colour : { ...colour, a };
}

/** sRGB 0..1 channels from an HSL triple, per CSS Color 4.
 *
 * Both HSL and HWB are ways of describing an sRGB colour, not spaces of their
 * own, so each converts to sRGB here and reaches OKLCH the same way `rgb()`
 * does. Neither can carry a wide-gamut colour, which is why the picker works in
 * OKLCH and offers these only at its edges. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 30;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** The HSL triple for an sRGB colour: hue in degrees, saturation and lightness
 * as 0..1 fractions. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];

  // The denominator is the distance from whichever end of the range is nearer,
  // so saturation reads 1 for a pure hue at any lightness.
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

/** Format as `hsl(H S% L%)`, or `hsl(H S% L% / A)` when not opaque.
 *
 * Clamped into `gamut` first, like every other output: HSL describes sRGB, so a
 * wider colour has to land somewhere reachable before it can be written at all.
 * A colour outside sRGB is therefore lossy here in a way `oklch()` is not. */
export function formatHsl(colour: Oklch, gamut: Gamut = SRGB): string {
  const [r, g, b] = oklchToRgb255(colour, gamut);
  const [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
  const base = `${round(h, 2)} ${round(s * 100, 2)}% ${round(l * 100, 2)}%`;
  return hasAlpha(colour) ? `hsl(${base} / ${round(colour.a, 4)})` : `hsl(${base})`;
}

/** Format as `hwb(H W% B%)`, or `hwb(H W% B% / A)` when not opaque.
 *
 * Whiteness and blackness are the smallest and largest sRGB channels, so this
 * shares `gamut` clamping with `formatHsl` for the same reason. */
export function formatHwb(colour: Oklch, gamut: Gamut = SRGB): string {
  const [r255, g255, b255] = oklchToRgb255(colour, gamut);
  const [r, g, b] = [r255 / 255, g255 / 255, b255 / 255] as [number, number, number];
  const [h] = rgbToHsl(r, g, b);
  const w = Math.min(r, g, b);
  const bl = 1 - Math.max(r, g, b);
  const base = `${round(h, 2)} ${round(w * 100, 2)}% ${round(bl * 100, 2)}%`;
  return hasAlpha(colour) ? `hwb(${base} / ${round(colour.a, 4)})` : `hwb(${base})`;
}

/** Shared tail of the `hsl()` and `hwb()` grammars: three components and an
 * optional alpha, in either the comma or the space form. */
const HSL_LIKE = String.raw`\(\s*([\d.+-]+)(?:deg)?[\s,]+([\d.+-]+)%?[\s,]+([\d.+-]+)%?\s*(?:[,/]\s*([\d.+-]+)(%?)\s*)?\)$`;

/** Read the optional alpha shared by every functional form. `undefined` means
 * the string carried none; `null` means it carried one that was not a number. */
function tailAlpha(raw: string | undefined, pct: string | undefined): number | null | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clamp(pct === "%" ? n / 100 : n, 0, 1);
}

/** Parse `hsl()` or `hsla()`, in either the comma or the space form.
 *
 * Hue accepts a bare number or `deg` and wraps, matching CSS. Saturation and
 * lightness are percentages, with or without the sign, and clamp to 0..100. */
export function parseHsl(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  const m = value.trim().match(new RegExp(`^hsla?${HSL_LIKE}`, "i"));
  if (!m) return null;

  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  if (![h, s, l].every(Number.isFinite)) return null;

  const [r, g, b] = hslToRgb(h, clamp(s, 0, 100) / 100, clamp(l, 0, 100) / 100);
  const to255 = (v: number) => Math.round(clamp(v, 0, 1) * 255);
  const colour = hexToOklch(
    `#${[r, g, b].map((v) => to255(v).toString(16).padStart(2, "0")).join("")}`,
  );
  if (!colour) return null;

  const a = tailAlpha(m[4], m[5]);
  if (a === null) return null;
  return a === undefined || a >= 1 ? colour : { ...colour, a };
}

/** Parse `hwb()`, in either the comma or the space form.
 *
 * Whiteness and blackness summing past 100% is not an error: CSS says the
 * colour is the grey their ratio describes, so they are normalised rather than
 * rejected. */
export function parseHwb(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  const m = value.trim().match(new RegExp(`^hwb${HSL_LIKE}`, "i"));
  if (!m) return null;

  const h = Number(m[1]);
  let w = Number(m[2]);
  let bl = Number(m[3]);
  if (![h, w, bl].every(Number.isFinite)) return null;
  w = clamp(w, 0, 100) / 100;
  bl = clamp(bl, 0, 100) / 100;

  // Past 100% together there is no hue left to show, only the grey between them.
  if (w + bl >= 1) {
    const grey = w / (w + bl);
    const v = Math.round(grey * 255)
      .toString(16)
      .padStart(2, "0");
    const colour = hexToOklch(`#${v}${v}${v}`);
    if (!colour) return null;
    const a = tailAlpha(m[4], m[5]);
    if (a === null) return null;
    return a === undefined || a >= 1 ? colour : { ...colour, a };
  }

  // Otherwise the pure hue, compressed into what the two ends leave.
  const [pr, pg, pb] = hslToRgb(h, 1, 0.5);
  const mix = (v: number) => Math.round(clamp(v * (1 - w - bl) + w, 0, 1) * 255);
  const colour = hexToOklch(
    `#${[pr, pg, pb].map((v) => mix(v).toString(16).padStart(2, "0")).join("")}`,
  );
  if (!colour) return null;

  const a = tailAlpha(m[4], m[5]);
  if (a === null) return null;
  return a === undefined || a >= 1 ? colour : { ...colour, a };
}

/** Accepts any supported form and returns OKLCH, or null if unparseable.
 *
 * Order matters only for speed, since the forms cannot be confused: each parser
 * anchors on its own prefix, and hex is the only one without a function name. */
export function toOklch(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  return (
    parseOklch(value) ?? parseRgb(value) ?? parseHsl(value) ?? parseHwb(value) ?? hexToOklch(value)
  );
}

/** Highest chroma that fits in sRGB here. Peaks mid-lightness, collapses to white and black. */
export function maxChroma(l: number, h: number, gamut: Gamut = SRGB): number {
  return bisectChroma(l, h, gamut.maxChroma, gamut);
}

/** One column of a gamut chart: where along the axis, and how far it reaches. */
export interface GamutColumn {
  /** Position along the axis, 0..1. */
  t: number;
  /** Max chroma at this position, in absolute OKLCH chroma units. */
  c: number;
  /** The colour to paint this column, already gamut-clamped. */
  hex: string;
}

/** The 2D slice a chart shows: which axis is held fixed, and what the screen's
 * horizontal and vertical axes sweep. Each chart varies the two components it
 * does not itself control, so the three are genuinely different views rather
 * than the same curve drawn twice. */
export const CHART_PLANES: Record<Axis, { x: Axis; y: Axis }> = {
  l: { x: "h", y: "c" },
  c: { x: "h", y: "l" },
  h: { x: "l", y: "c" },
};

/** The full-scale value of an axis, for mapping 0..1 chart positions onto it.
 *
 * The curve, the crosshair, and a drag all read this, so it is the one place
 * the chart's scale is decided. Change it here or they desync. */
export function axisMax(axis: Axis, gamut: Gamut = SRGB): number {
  if (axis === "h") return 360;
  if (axis === "c") return gamut.chartMaxChroma;
  return 1;
}

/** The colour at a point in a chart's slice plane, with `fixed` held from
 * `base`. `x` and `y` are 0..1 across the plot, y measured bottom-up. */
export function chartColour(
  base: Oklch,
  fixed: Axis,
  x: number,
  y: number,
  gamut: Gamut = SRGB,
): Oklch {
  const { x: xAxis, y: yAxis } = CHART_PLANES[fixed];
  return {
    ...base,
    [xAxis]: x * axisMax(xAxis, gamut),
    [yAxis]: y * axisMax(yAxis, gamut),
  } as Oklch;
}

/** The most columns a curve is drawn with, however many are asked for.
 *
 * The chart's viewBox is 100 units wide, so past a few hundred columns each one
 * is well under a pixel and adds nothing to see. The cap matters because the
 * lightness-vertical plane scans for its ceiling per column, which is quadratic
 * in this number: at 2000 it took over a tenth of a second per curve, and that
 * is a frozen drag in a browser and a blocked event loop under SSR. */
export const MAX_CHART_COLUMNS = 512;

/** Cross-section of the sRGB gamut in a chart's slice plane. Each column is the
 * highest in-gamut point of the vertical axis, as a 0..1 fraction of that axis.
 *
 * For a chroma-vertical plane that is `maxChroma` directly. For the C card the
 * vertical axis is lightness, where the in-gamut run is a band with both a
 * floor and a ceiling, so the column reports the ceiling and the fill is read
 * from the gradient beneath it.
 *
 * The scan for that ceiling is linear rather than a bisection, deliberately.
 * The band is *usually* contiguous, but not always: of 2376 sampled columns, 35
 * held more than one run, and a bisection over those would settle on whichever
 * run its midpoints happened to land in. Walking down from the top always finds
 * the real ceiling. `MAX_CHART_COLUMNS` is what keeps the cost bounded. */
export function gamutCurve(
  base: Oklch,
  fixed: Axis,
  requested = 64,
  gamut: Gamut = SRGB,
): GamutColumn[] {
  const columns = Math.max(1, Math.min(Math.floor(requested) || 64, MAX_CHART_COLUMNS));
  const { x: xAxis, y: yAxis } = CHART_PLANES[fixed];
  const out: GamutColumn[] = [];
  const yScale = axisMax(yAxis, gamut);

  for (let i = 0; i <= columns; i++) {
    const t = i / columns;
    const at = (y: number) => chartColour(base, fixed, t, y, gamut);

    let c: number;
    if (yAxis === "c") {
      // Chroma vertical: the boundary is the reachable chroma at this column.
      const probe = at(0);
      c = maxChroma(probe.l, probe.h, gamut) / yScale;
    } else {
      // Lightness vertical at fixed chroma: scan for the highest lightness that
      // still fits. Below some lightness the chroma is unreachable too, so this
      // is a band, not a region anchored at zero.
      c = 0;
      for (let j = columns; j >= 0; j--) {
        if (inGamut(at(j / columns), gamut)) {
          c = j / columns;
          break;
        }
      }
    }

    // Each column takes its own most-saturated in-gamut colour.
    out.push({ t, c, hex: oklchToHex(clampToGamut(at(c), gamut)) });
  }
  return out;
}

/** Hue buckets, upper bound (exclusive) -> name. */
const HUE_NAMES: [number, string][] = [
  [15, "Red"],
  [40, "Orange"],
  [75, "Amber"],
  [110, "Yellow"],
  [160, "Green"],
  [200, "Teal"],
  [240, "Cyan"],
  [280, "Blue"],
  [320, "Violet"],
  [350, "Pink"],
];

/** Names a colour in words. Hue alone is too coarse, so lightness and chroma qualify it. */
export function colourName(value: string | null | undefined): string {
  if (!value) return "Default";
  const c = toOklch(value);
  if (!c) return "Custom";

  // Achromatic: hue carries no information, so name by lightness.
  if (c.c < 0.03) {
    if (c.l >= 0.95) return "White";
    if (c.l <= 0.08) return "Black";
    if (c.l >= 0.75) return "Light grey";
    if (c.l <= 0.35) return "Dark grey";
    return "Grey";
  }

  const hue = ((c.h % 360) + 360) % 360;
  let base = "Red"; // hues past the last bucket wrap back around to red
  for (const [max, name] of HUE_NAMES) {
    if (hue < max) {
      base = name;
      break;
    }
  }

  // One qualifier only, so names stay short.
  if (c.l <= 0.45) return `Dark ${base.toLowerCase()}`;
  if (c.l >= 0.85) return `Pale ${base.toLowerCase()}`;
  if (c.c < 0.07) return `Muted ${base.toLowerCase()}`;
  return base;
}

/** WCAG relative luminance, for picking readable text over a swatch. */
export function isLight(colour: Oklch): boolean {
  const [r, g, b] = oklchToLinearRgb(clampToGamut(colour)).map((v) => clamp(v, 0, 1)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35;
}
