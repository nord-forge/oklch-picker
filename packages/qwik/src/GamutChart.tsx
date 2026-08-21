/** A 2D slice of the gamut: the chart holds one axis fixed and sweeps the other
 * two, so under the curve is displayable and above it is not. */
import {
  $,
  type QRL,
  component$,
  useComputed$,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { Axis, Oklch } from "@oklch-picker/core";
import {
  CHART_H,
  CHART_W,
  chartBase,
  chartKey,
  gamutChartModel,
  labelTransform,
} from "@oklch-picker/core";
import { type GamutId, gamutFrom, gamutsFrom } from "./gamuts.js";

export interface GamutChartProps {
  base: Oklch;
  /** The axis held fixed; the chart sweeps the other two. */
  axis: Axis;
  /** Reference spaces to outline over the filled region. Ids, not objects,
   * for the reason in `gamuts.ts`. */
  references?: GamutId[] | undefined;
  /** The output space. The filled region is this gamut's reach, so a P3 picker
   * plots P3 rather than sRGB with an outline drawn over it. */
  gamut?: GamutId | undefined;
  /** Every space in view, drawn or not, which sets the vertical scale. */
  scaleGamuts?: GamutId[] | undefined;
  /** 0..1 across the plot; drives the vertical crosshair. */
  x: number;
  /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
  y: number;
  /** Unique per instance. SVG gradient ids share a document-wide namespace. */
  id: string;
  /** Columns to sample. More is smoother; 64 costs well under a millisecond. */
  resolution?: number | undefined;
  /** 0..1 plot coordinates as the pointer moves. Omit for a display-only
   * chart. */
  onPick$?: QRL<(x: number, y: number) => void>;
  /** A drag ended, so the caller can record the settled colour rather than
   * every value the gesture passed through. */
  onPicked$?: QRL<() => void>;
  classPrefix: string;
}

export const GamutChart = component$<GamutChartProps>((props) => {
  const svg = useSignal<SVGSVGElement>();
  /** The chart's rendered pixel size, for the label counter-scale. Observed
   * rather than assumed: the chart is fluid, and the ratio changes with it. */
  const w = useSignal(0);
  const h = useSignal(0);

  // A visible task rather than an effect: this runs only in the browser, which
  // is where a ResizeObserver can exist at all. The server render skips it and
  // the labels stay hidden until the chart is measured.
  useVisibleTask$(({ cleanup }) => {
    // Guarded rather than assumed. A visible task is browser-only in a real
    // app, but Qwik's own test harness runs it in whatever environment the
    // suite provides, and this one is node.
    if (typeof ResizeObserver === "undefined") return;
    const node = svg.value;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r) {
        w.value = r.width;
        h.value = r.height;
      }
    });
    observer.observe(node);
    cleanup(() => observer.disconnect());
  });

  // Keying on the axis the chart holds fixed means dragging either swept axis
  // reuses the curve and its ~65 gradient stops. `useComputed$` recomputes only
  // when a signal it read changes, which is the same bargain the other
  // adapters strike with an explicit memo.
  const curve = useComputed$(() => {
    const key = chartKey(props.base, props.axis);
    return gamutChartModel(
      chartBase(key, props.axis),
      props.axis,
      props.resolution ?? 64,
      gamutsFrom(props.references),
      gamutFrom(props.gamut),
      gamutsFrom(props.scaleGamuts),
    );
  });

  const gradId = `${props.classPrefix}-gamut-${props.id}`;
  const crossY = CHART_H - Math.min(1, Math.max(0, props.y)) * CHART_H;
  const interactive = Boolean(props.onPick$);

  // Pointer capture keeps a drag alive once it leaves the chart, so the value
  // still tracks rather than sticking at the edge.
  const pick = $((e: PointerEvent, node: SVGSVGElement) => {
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) return;
    return {
      x: (e.clientX - r.left) / r.width,
      y: (r.bottom - e.clientY) / r.height,
    };
  });

  return (
    <svg
      ref={svg}
      class={
        interactive
          ? `${props.classPrefix}__chart ${props.classPrefix}__chart--interactive`
          : `${props.classPrefix}__chart`
      }
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      onPointerDown$={async (e, node) => {
        if (!props.onPick$) return;
        node.setPointerCapture(e.pointerId);
        const at = await pick(e, node);
        if (at) await props.onPick$(at.x, at.y);
      }}
      onPointerMove$={async (e, node) => {
        if (!props.onPick$ || !node.hasPointerCapture(e.pointerId)) return;
        const at = await pick(e, node);
        if (at) await props.onPick$(at.x, at.y);
      }}
      // The release is the commit; the drag itself is a continuous preview.
      onPointerUp$={async () => {
        await props.onPicked$?.();
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {curve.value.stops.map((s) => (
            <stop key={s.offset} offset={`${s.offset}%`} stop-color={s.hex} />
          ))}
        </linearGradient>
      </defs>

      <path
        d={`M0,${CHART_H} L${curve.value.path} L${CHART_W},${CHART_H} Z`}
        fill={`url(#${gradId})`}
      />
      <path d={`M${curve.value.path}`} fill="none" class={`${props.classPrefix}__chart-line`} />

      {curve.value.boundaries.map((b) => {
        // Named on the line, because a dashed outline with no label leaves the
        // reader guessing which space it marks. The viewBox is stretched
        // non-uniformly, so text placed straight into it is huge and squashed.
        // `labelTransform` undoes the scale. Null until the chart has been
        // measured, since no label beats a wrong one for a frame.
        const transform = labelTransform(b.labelX, b.labelY, w.value, h.value);
        return (
          <g key={b.id}>
            <path
              d={`M${b.path}`}
              fill="none"
              class={`${props.classPrefix}__gamut-boundary ${props.classPrefix}__gamut-boundary--${b.id}`}
            />
            {transform && (
              <g transform={transform}>
                <text class={`${props.classPrefix}__gamut-label`} text-anchor="middle" y="-5">
                  {b.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      <line
        x1={props.x * CHART_W}
        x2={props.x * CHART_W}
        y1="0"
        y2={CHART_H}
        class={`${props.classPrefix}__crosshair`}
      />
      <line x1="0" x2={CHART_W} y1={crossY} y2={crossY} class={`${props.classPrefix}__crosshair`} />
    </svg>
  );
});
