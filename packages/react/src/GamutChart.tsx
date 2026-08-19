/** A 2D slice of the sRGB gamut: the chart holds one axis fixed and sweeps the
 * other two, so under the curve is displayable and above it is not. */
import type { Axis, Oklch } from "@oklch-picker/core";
import { CHART_H, CHART_W, chartBase, chartKey, gamutChartModel } from "@oklch-picker/core";
import { useMemo, useRef } from "react";

export interface GamutChartProps {
  base: Oklch;
  /** The axis held fixed; the chart sweeps the other two. */
  axis: Axis;
  /** 0..1 across the plot; drives the vertical crosshair. */
  x: number;
  /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
  y: number;
  /** Unique per instance — SVG gradient ids share a document-wide namespace. */
  id: string;
  /** Columns to sample. More is smoother; 64 costs well under a millisecond. */
  resolution?: number;
  /** Called with 0..1 plot coordinates as the pointer moves. Omit for a
   * display-only chart. */
  onPick?: (x: number, y: number) => void;
  classPrefix: string;
}

export function GamutChart(props: GamutChartProps) {
  const { axis, onPick } = props;
  const resolution = props.resolution ?? 64;
  const svg = useRef<SVGSVGElement>(null);
  // Keying the memo on the axis the chart holds fixed means dragging either
  // swept axis reuses the curve and its ~65 gradient stops.
  const curveInput = chartKey(props.base, axis);
  const { path, stops } = useMemo(() => {
    const m = gamutChartModel(chartBase(curveInput, axis), axis, resolution);
    return {
      path: m.path,
      stops: m.stops.map((s) => <stop key={s.offset} offset={`${s.offset}%`} stopColor={s.hex} />),
    };
  }, [axis, curveInput, resolution]);
  const gradId = `${props.classPrefix}-gamut-${props.id}`;
  const crossY = CHART_H - Math.min(1, Math.max(0, props.y)) * CHART_H;

  // Pointer capture keeps a drag alive once it leaves the chart, so the value
  // still tracks rather than sticking at the edge.
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onPick || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    onPick((e.clientX - r.left) / r.width, (r.bottom - e.clientY) / r.height);
  };

  return (
    <svg
      ref={svg}
      className={`${props.classPrefix}__chart${onPick ? ` ${props.classPrefix}__chart--interactive` : ""}`}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      onPointerDown={
        onPick
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pick(e);
            }
          : undefined
      }
      onPointerMove={
        onPick ? (e) => e.currentTarget.hasPointerCapture(e.pointerId) && pick(e) : undefined
      }
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {stops}
        </linearGradient>
      </defs>

      <path d={`M0,${CHART_H} L${path} L${CHART_W},${CHART_H} Z`} fill={`url(#${gradId})`} />
      <path d={`M${path}`} fill="none" className={`${props.classPrefix}__chart-line`} />

      <line
        x1={props.x * CHART_W}
        x2={props.x * CHART_W}
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
