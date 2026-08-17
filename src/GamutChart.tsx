/** The sRGB gamut swept along one axis: under the curve is displayable, above is not. */
import { useMemo } from "react";
import type { Axis, Oklch } from "./colour.js";
import { CHART_H, CHART_W, gamutChartModel } from "./model.js";

export interface GamutChartProps {
  base: Oklch;
  axis: Axis;
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
  const { axis } = props;
  const resolution = props.resolution ?? 64;
  // The curve never reads chroma, and only one of the other two axes: the
  // lightness silhouette depends on hue alone, the chroma and hue silhouettes
  // on lightness alone. Keying the memo on that single input means dragging
  // any other slider reuses the curve and its ~65 gradient stops.
  const curveInput = axis === "l" ? props.base.h : props.base.l;
  const { path, stops } = useMemo(() => {
    const base = axis === "l" ? { l: 0, c: 0, h: curveInput } : { l: curveInput, c: 0, h: 0 };
    const m = gamutChartModel(base, axis, resolution);
    return {
      path: m.path,
      stops: m.stops.map((s) => <stop key={s.offset} offset={`${s.offset}%`} stopColor={s.hex} />),
    };
  }, [axis, curveInput, resolution]);
  const gradId = `${props.classPrefix}-gamut-${props.id}`;
  const crossY = CHART_H - Math.min(1, Math.max(0, props.chromaFraction)) * CHART_H;

  return (
    <svg
      className={`${props.classPrefix}__chart`}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {stops}
        </linearGradient>
      </defs>

      <path d={`M0,${CHART_H} L${path} L${CHART_W},${CHART_H} Z`} fill={`url(#${gradId})`} />
      <path d={`M${path}`} fill="none" className={`${props.classPrefix}__chart-line`} />

      <line
        x1={props.position * CHART_W}
        x2={props.position * CHART_W}
        y1="0"
        y2={CHART_H}
        className={`${props.classPrefix}__crosshair`}
      />
      <line
        x1="0"
        x2={CHART_W}
        y1={crossY}
        y2={crossY}
        className={`${props.classPrefix}__crosshair`}
      />
    </svg>
  );
}
