// Generates the icon marks from the library's own maxChroma, so the silhouette
// is the real sRGB gamut rather than a drawing of it. Run after `npm run build`.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maxChroma, oklchToHex } from "../dist/colour.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs", "media");
mkdirSync(out, { recursive: true });

const INK = "#0d1117";
const PAPER = "#ffffff";
const round = (n) => Number(n.toFixed(2));

// Collapses the indentation used for readability above. Numbers and path data
// are already emitted tight by num()/args(), so this only touches whitespace
// between elements — it cannot alter geometry.
function minify(svg) {
  return `${svg
    .replace(/>\s+</g, "><")
    .replace(/ \/>/g, "/>")
    .trim()}\n`;
}

// Formats a number the way a path wants it: no trailing zeros, no leading zero
// on decimals, and no separator needed before a negative sign.
const num = (n) => {
  const s = Number(n.toFixed(2)).toString();
  return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? `-${s.slice(2)}` : s;
};

// Appends path arguments to `d`, dropping the separator only where the next
// number is self-delimiting (starts with a minus, or with a bare decimal point
// when the previous number has no decimal part of its own to run into).
function push(d, ...ns) {
  for (const n of ns) {
    const s = num(n);
    const needsSep = d !== "" && !/[\s,A-Za-z]$/.test(d) && !s.startsWith("-");
    d += needsSep ? ` ${s}` : s;
  }
  return d;
}

// Catmull-Rom through the sampled points, so the peak reads as a curve rather
// than the polyline spike a straight L-join produces.
//
// Emitted as relative `c` with the command letter written once: in path syntax
// a repeated command is implicit, so 24 segments cost one letter, not 24.
function smooth(pts) {
  let d = `${push("M", pts[0][0], pts[0][1])}c`;
  let [cxr, cyr] = pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    // Relative to the current point, which is the previous segment's end.
    d = push(d, c1[0] - cxr, c1[1] - cyr, c2[0] - cxr, c2[1] - cyr, p2[0] - cxr, p2[1] - cyr);
    [cxr, cyr] = p2;
  }
  return d;
}

// The mark shows one segment of the hue sweep, from gamutCurve's own maths:
// yellow-green through aqua to blue.
const ICON_FROM = 128;
const ICON_TO = 250;

function iconCurve(steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const h = ICON_FROM + t * (ICON_TO - ICON_FROM);
    const l = 0.65;
    const c = maxChroma(l, h);
    out.push({ t, c, hex: oklchToHex({ l, c, h }) });
  }
  return out;
}

// Maps the curve into a band between `floor` and `ceil` (fractions of height).
// Peaks must not reach the top edge — clipped humps read as drips, not a curve.
// `floor` is where the curve's minimum sits, so 0.75 leaves the trough covering
// a quarter of the height rather than collapsing to the baseline.
function sliceGeom(w, h, steps, floor, ceil, source) {
  const cols = source(steps);
  const lo = Math.min(...cols.map((c) => c.c));
  const hi = Math.max(...cols.map((c) => c.c));
  const x = (t) => t * w;
  const y = (c) => h * (floor - ((c - lo) / (hi - lo)) * (floor - ceil));
  return { cols, x, y };
}

function hueSlice(w, h, steps, floor, ceil, source) {
  const { cols, x, y } = sliceGeom(w, h, steps, floor, ceil, source);
  const pts = cols.map((c) => [x(c.t), y(c.c)]);
  // Down the right edge, along the bottom, and closed — V/H beat two L pairs.
  return `${smooth(pts)}V${num(h)}H0Z`;
}

// Where the curve actually is at position t — so the crosshair can sit on a
// point the gamut can reach, not in the empty region above the curve.
function pointOn(w, h, steps, floor, ceil, source, t) {
  const { cols, x, y } = sliceGeom(w, h, steps, floor, ceil, source);
  let best = cols[0];
  for (const c of cols) if (Math.abs(c.t - t) < Math.abs(best.t - t)) best = c;
  return { x: x(best.t), y: y(best.c), hex: best.hex };
}

const toStops = (cols) =>
  cols.map((c) => `    <stop offset="${num(c.t * 100)}%" stop-color="${c.hex}" />`).join("\n");

const iconStops = (steps) => toStops(iconCurve(steps));

// 2. Hue cross-section in a rounded tile. Shows the 128-250 degree segment
// (yellow-green through aqua to blue) rather than the full sweep: 360 degrees
// of humps cannot be tall enough to read at 16px without clipping the corners.
//
// Three tiers, drawn rather than scaled. Detail that reads at 512px turns to
// mush at 16px, so each tier drops what its size cannot carry:
//   small  16-32px   curve and tile only; guides and ring are noise here
//   medium 48-128px  dotted guides and the ring, thin strokes
//   large  256px+    same, with proportionally finer guides and a larger ring
const TIERS = {
  small: { size: 64, radius: 14, guides: false, ring: 0, guideWidth: 0, ringWidth: 0 },
  medium: { size: 128, radius: 30, guides: true, ring: 8, guideWidth: 2, ringWidth: 3 },
  large: { size: 512, radius: 116, guides: true, ring: 30, guideWidth: 6, ringWidth: 10 },
};

// floor 0.75 keeps the teal trough covering the bottom quarter of the tile.
const FLOOR = 0.75;
const CEIL = 0.14;
// 24 segments: past this the curve's worst deviation stalls near 3% of peak
// chroma, so extra points cost bytes without changing the drawn shape.
const STEPS = 24;
// The hue at which the ring is picked — the teal minimum of the curve.
const PICK_T = 0.583;

function mark(ground, tier) {
  const { size: s, radius, guides, ring, guideWidth, ringWidth } = TIERS[tier];
  // The ring sits on the curve itself, at the hue where it is picked.
  const at = pointOn(s, s, STEPS, FLOOR, CEIL, iconCurve, PICK_T);
  // Guides and ring are drawn in the tile's contrasting tone.
  const halo = ground === INK ? PAPER : INK;
  const dash = round(guideWidth * 1.5);
  const overlay = guides
    ? `
    <path d="M0 ${num(at.y)}H${s}M${num(at.x)} 0V${s}" fill="none" stroke="${halo}" stroke-width="${guideWidth}" stroke-dasharray="${dash} ${dash * 2}" stroke-linecap="round" opacity="0.85" />
    <circle cx="${round(at.x)}" cy="${round(at.y)}" r="${ring}" fill="none" stroke="${halo}" stroke-width="${ringWidth}" />`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-label="oklch-picker">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="0">
${iconStops(12)}
    </linearGradient>
    <clipPath id="a">
      <rect width="${s}" height="${s}" rx="${radius}" />
    </clipPath>
  </defs>
  <rect width="${s}" height="${s}" rx="${radius}" fill="${ground}" />
  <g clip-path="url(#a)">
    <path d="${hueSlice(s, s, STEPS, FLOOR, CEIL, iconCurve)}" fill="url(#b)" />${overlay}
  </g>
</svg>
`;
}

// Named for the page the mark sits on, not for its own tile: on a light page
// the tile is ink, so the guides and ring read as white.
const files = {
  "mark-sm-light.svg": mark(INK, "small"),
  "mark-sm-dark.svg": mark(PAPER, "small"),
  "mark-light.svg": mark(INK, "medium"),
  "mark-dark.svg": mark(PAPER, "medium"),
  "mark-lg-light.svg": mark(INK, "large"),
  "mark-lg-dark.svg": mark(PAPER, "large"),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), minify(svg));
console.log(`wrote ${Object.keys(files).join(", ")} to docs/media/`);
