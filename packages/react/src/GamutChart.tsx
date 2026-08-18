/** The sRGB gamut swept along one axis: under the curve is displayable, above is not. */
import type { Axis, Oklch } from "@oklch-picker/core";
import { CHART_H, CHART_W, chartBase, chartKey, gamutChartModel } from "@oklch-picker/core";
import { useMemo } from "react";

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
  // Keying the memo on the curve's single input means dragging any other
  // slider reuses the curve and its ~65 gradient stops.
  const curveInput = chartKey(props.base, axis);
  const { path, stops } = useMemo(() => {
    const m = gamutChartModel(chartBase(curveInput, axis), axis, resolution);
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
