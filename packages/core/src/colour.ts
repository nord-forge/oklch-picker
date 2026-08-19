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
}

export type Axis = "l" | "c" | "h";

/** Chroma high enough that no sRGB colour reaches it — the slider's upper end. */
export const MAX_CHROMA = 0.37;

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (n: number, dp: number) => Number(n.toFixed(dp));

/** Parse `oklch(L C H)`, returning null when the string is not that form. */
export function parseOklch(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
  if (!m) return null;
  const [l, c, h] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (![l, c, h].every(Number.isFinite)) return null;
  return { l, c, h };
}

/** Format as the `oklch(L C H)` string the API stores. */
export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${round(l, 4)} ${round(c, 4)} ${round(((h % 360) + 360) % 360, 2)})`;
}

/** OKLCH -> linear sRGB channels (may fall outside 0..1 when out of gamut). */
function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);

  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;

  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** True when the colour is representable in sRGB (within a small tolerance).
 *
 * The tolerance is applied to the *encoded* channel, not the linear one. A
 * linear epsilon is wildly asymmetric — 0.0005 of linear light is about 1.6/255
 * near black but 0.06/255 near white — so it used to admit a band of
 * unrepresentable near-black colours. An encoded epsilon means the same thing
 * at both ends: a tenth of an 8-bit step, enough to absorb bisection error
 * without letting a visibly different colour through.
 *
 * Fitting inside the cube is necessary but not sufficient. Near black the cube
 * still holds chroma that quantises away — at L=0 every chroma below ~0.039 is
 * `#000000`, indistinguishable from the achromatic colour. Requiring a
 * distinguishable channel is what makes the gamut close to a point at black
 * rather than reporting a width that no screen can show. */
export function inGamut(colour: Oklch): boolean {
  const eps = 0.1 / 255;
  const rgb = oklchToLinearRgb(colour);
  if (!rgb.every((v) => linearToSrgb(v) >= -eps && linearToSrgb(v) <= 1 + eps)) return false;
  if (colour.c === 0) return true;

  // Distinguishable from grey at the same lightness once quantised to 8 bits?
  const to255 = (v: number) => Math.round(clamp(linearToSrgb(v), 0, 1) * 255);
  const grey = oklchToLinearRgb({ ...colour, c: 0 }).map(to255);
  return rgb.map(to255).some((v, i) => v !== grey[i]);
}

/** Highest chroma <= hi that fits sRGB at this lightness and hue. Chroma is
 * monotonic for gamut membership at fixed L and H, so bisect. */
function bisectChroma(l: number, h: number, upper: number): number {
  let lo = 0;
  let hi = upper;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Reduce chroma until the colour fits sRGB, keeping lightness and hue. */
export function clampToGamut(colour: Oklch): Oklch {
  if (inGamut(colour)) return colour;
  return { ...colour, c: bisectChroma(colour.l, colour.h, colour.c) };
}

/** OKLCH -> `#rrggbb`. Out-of-gamut colours are clamped first. */
export function oklchToHex(colour: Oklch): string {
  const [r, g, b] = oklchToLinearRgb(clampToGamut(colour));
  const to255 = (v: number) =>
    clamp(Math.round(linearToSrgb(v) * 255), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/** `#rgb` / `#rrggbb` -> OKLCH. Returns null for anything else. */
export function hexToOklch(hex: string): Oklch | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const raw = m[1] as string;
  const full = raw.length === 3 ? raw.replace(/./g, "$&$&") : raw;
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
  return { l: L, c, h: c < 1e-6 ? 0 : h };
}

/** Accepts either stored form and returns OKLCH, or null if unparseable. */
export function toOklch(value: string | null | undefined): Oklch | null {
  if (!value) return null;
  return parseOklch(value) ?? hexToOklch(value);
}

/** Highest chroma that fits in sRGB here. Peaks mid-lightness, collapses to white and black. */
export function maxChroma(l: number, h: number): number {
  return bisectChroma(l, h, MAX_CHROMA);
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

/** Cross-section of the sRGB gamut along one axis — the silhouette above each slider. */
export function gamutCurve(base: Oklch, axis: Axis, columns = 64): GamutColumn[] {
  const out: GamutColumn[] = [];
  for (let i = 0; i <= columns; i++) {
    const t = i / columns;
    // Chroma swept against itself is a flat block, so plot it against hue.
    const l = axis === "l" ? t : base.l;
    const h = axis === "l" ? base.h : t * 360;
    const c = maxChroma(l, h);
    // Each column takes its own most-saturated in-gamut colour.
    out.push({ t, c, hex: oklchToHex({ l, c, h }) });
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
