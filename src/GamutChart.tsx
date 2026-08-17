/** The sRGB gamut swept along one axis: under the curve is displayable, above is not. */
import { type GamutColumn, MAX_CHROMA, type Oklch, gamutCurve } from "./colour.js";

const W = 100; // viewBox units; the SVG scales to its container
const H = 34;

function points(cols: GamutColumn[], yMax: number): string {
  return cols.map((c) => `${(c.t * W).toFixed(2)},${(H - (c.c / yMax) * H).toFixed(2)}`).join(" L");
}

export interface GamutChartProps {
  base: Oklch;
  axis: "l" | "c" | "h";
  /** 0..1 along the axis; drives the vertical crosshair. */
  position: number;
  /** 0..1 of chart height; drives the horizontal crosshair. */
  chromaFraction: number;
  /** Unique per instance — SVG gradient ids share a document-wide namespace. */
  id: string;
  /** Columns to sample. More is smoother; 64 costs well under a millisecond. */
  resolution?: number;
  classPrefix: string;
}

export function GamutChart(props: GamutChartProps) {
  const cols = gamutCurve(props.base, props.axis, props.resolution ?? 64);
  // Floor the scale so a flat curve does not blow up to full height.
  const peak = Math.max(...cols.map((c) => c.c));
  const yMax = Math.max(peak, MAX_CHROMA * 0.35);
  const gradId = `${props.classPrefix}-gamut-${props.id}`;
  const p = points(cols, yMax);
  const crossY = H - Math.min(1, Math.max(0, props.chromaFraction)) * H;

  return (
    <svg
      className={`${props.classPrefix}__chart`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {cols.map((c) => (
            <stop key={c.t} offset={`${c.t * 100}%`} stopColor={c.hex} />
          ))}
        </linearGradient>
      </defs>

      <path d={`M0,${H} L${p} L${W},${H} Z`} fill={`url(#${gradId})`} />
      <path d={`M${p}`} fill="none" className={`${props.classPrefix}__chart-line`} />

      <line
        x1={props.position * W}
        x2={props.position * W}
        y1="0"
        y2={H}
        className={`${props.classPrefix}__crosshair`}
      />
      <line x1="0" x2={W} y1={crossY} y2={crossY} className={`${props.classPrefix}__crosshair`} />
    </svg>
  );
}
