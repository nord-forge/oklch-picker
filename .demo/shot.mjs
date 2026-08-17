// Renders the picker to static HTML for screenshots, using the built package.
import { readFileSync, writeFileSync } from "node:fs";
import {
  clampToGamut, colourName, formatOklch, gamutCurve, inGamut, isLight,
  MAX_CHROMA, maxChroma, oklchToHex, toOklch,
} from "../dist/colour.mjs";

const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const P = "oklch-picker";
const W = 100, H = 34;

function chart(base, axis, position, chromaFraction, id) {
  const cols = gamutCurve(base, axis, 64);
  const peak = Math.max(...cols.map(c => c.c));
  const yMax = Math.max(peak, MAX_CHROMA * 0.35);
  const pts = cols.map(c => `${(c.t*W).toFixed(2)},${(H-(c.c/yMax)*H).toFixed(2)}`).join(" L");
  const stops = cols.map(c => `<stop offset="${c.t*100}%" stop-color="${c.hex}"/>`).join("");
  const cy = H - Math.min(1, Math.max(0, chromaFraction)) * H;
  return `<svg class="${P}__chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="g-${id}" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs>
    <path d="M0,${H} L${pts} L${W},${H} Z" fill="url(#g-${id})"/>
    <path d="M${pts}" fill="none" class="${P}__chart-line"/>
    <line x1="${position*W}" x2="${position*W}" y1="0" y2="${H}" class="${P}__crosshair"/>
    <line x1="0" x2="${W}" y1="${cy}" y2="${cy}" class="${P}__crosshair"/>
  </svg>`;
}

function atPos(base, axis, t, max) {
  if (axis === "l") return { ...base, l: t };
  if (axis === "c") return { ...base, c: t * max };
  return { ...base, h: t * 360 };
}
function track(base, axis, max) {
  const steps = axis === "h" ? 24 : 16;
  const stops = [];
  for (let i = 0; i <= steps; i++) stops.push(oklchToHex(clampToGamut(atPos(base, axis, i/steps, max))));
  return `linear-gradient(to right, ${stops.join(",")})`;
}
function spans(base, axis, max) {
  const steps = 64, out = []; let run = null;
  for (let i = 0; i <= steps; i++) {
    const t = i/steps, bad = !inGamut(atPos(base, axis, t, max));
    if (bad && run === null) run = t;
    if (!bad && run !== null) { out.push([run, t]); run = null; }
  }
  if (run !== null) out.push([run, 1]);
  return out;
}

function picker(value, presets) {
  const cur = toOklch(value);
  const hex = oklchToHex(cur);
  const canonical = formatOklch(clampToGamut(cur));
  const reach = maxChroma(cur.l, cur.h);
  const chromaMax = Math.max(0.02, Math.ceil(reach*100)/100);
  const axes = [
    { key: "l", label: "Lightness", max: 1, value: cur.l },
    { key: "c", label: "Chroma", max: chromaMax, value: Math.min(cur.c, chromaMax) },
    { key: "h", label: "Hue", max: 360, value: cur.h },
  ];
  const swatches = presets.map(p =>
    `<button class="${P}__preset${p===canonical?` ${P}__preset--selected`:""}" style="background:${p}"></button>`).join("");
  const rows = axes.map(a => {
    const pos = a.key === "h" ? cur.h/360 : a.key === "l" ? cur.l : a.value/Math.max(a.max,1e-6);
    const pct = (a.value - 0) / (a.max - 0);
    const hatch = spans(cur, a.key, a.max)
      .map(([s,e]) => `<span class="${P}__out-of-gamut" style="left:${s*100}%;width:${(e-s)*100}%"></span>`).join("");
    return `<div class="${P}__axis">
      <span class="${P}__axis-head"><span class="${P}__axis-label">${a.label}</span>
      <output class="${P}__axis-value">${a.key==="h"?Math.round(a.value):a.value.toFixed(2)}</output></span>
      ${chart(cur, a.key, pos, cur.c/Math.max(reach,1e-6), a.key)}
      <span class="${P}__track"><span class="${P}__track-fill" style="background:${track(cur,a.key,a.max)}"></span>${hatch}
      <input type="range" class="${P}__slider" min="0" max="${a.max}" value="${a.value}" style="--p:${pct}"></span>
    </div>`;
  }).join("");
  return `<div class="${P}">
    <div class="${P}__presets">${swatches}</div>
    ${rows}
    <div class="${P}__footer">
      <span class="${P}__preview" style="background:${hex};color:${isLight(cur)?"#000":"#fff"}"></span>
      <input class="${P}__hex" value="${hex}">
      <span class="${P}__name">${colourName(canonical)}</span>
    </div>
  </div>`;
}

const PRESETS = ["oklch(0.75 0.16 145)","oklch(0.7 0.15 255)","oklch(0.76 0.15 60)","oklch(0.72 0.15 320)","oklch(0.74 0.13 195)","oklch(0.68 0.14 30)"];

const page = (body, theme) => `<!doctype html><html><head><meta charset="utf-8"><style>
${css}
html{color-scheme:${theme}}
body{margin:0;padding:24px;background:${theme==="dark"?"#0e0e10":"#f7f7f5"};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:24px;align-items:flex-start}
.card{width:320px;padding:16px;border-radius:12px;background:${theme==="dark"?"#141416":"#fff"};border:1px solid ${theme==="dark"?"#2a2a2d":"#e4e4e2"}}
/* Render the native thumb at the right spot for a static shot. */
.${P}__slider{-webkit-appearance:none;appearance:none;background:none}
.${P}__slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:999px;background:#fff;border:2px solid rgba(0,0,0,.55)}
</style></head><body>${body}</body></html>`;

writeFileSync(new URL("dark.html", import.meta.url),
  page(`<div class="card">${picker("oklch(0.7 0.15 255)", PRESETS)}</div>
        <div class="card">${picker("oklch(0.76 0.15 60)", PRESETS)}</div>`, "dark"));
writeFileSync(new URL("light.html", import.meta.url),
  page(`<div class="card">${picker("oklch(0.55 0.22 25)", PRESETS)}</div>`, "light"));
console.log("wrote .demo/dark.html and .demo/light.html");
