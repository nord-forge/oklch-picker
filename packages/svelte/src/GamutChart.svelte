<script lang="ts">
/** A 2D slice of the sRGB gamut: the chart holds one axis fixed and sweeps the
 * other two, so under the curve is displayable and above it is not. `$derived`
 * memoises the curve, so dragging an axis that does not feed it reuses the path
 * and its ~65 gradient stops. */
import type { Axis } from "@oklch-picker/core";
import { CHART_H, CHART_W, chartBase, gamutChartModel } from "@oklch-picker/core";

interface Props {
  /** The axis held fixed; the chart sweeps the other two. */
  axis: Axis;
  /** Memo key: the single input this curve depends on. */
  curveKey: number;
  /** 0..1 across the plot; drives the vertical crosshair. */
  x: number;
  /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
  y: number;
  /** Called with 0..1 plot coordinates as the pointer moves. Omit for a
   * display-only chart. */
  onpick?: (x: number, y: number) => void;
  classPrefix: string;
  resolution?: number;
}

const { axis, curveKey, x, y, onpick, classPrefix, resolution = 64 }: Props = $props();

const curve = $derived(gamutChartModel(chartBase(curveKey, axis), axis, resolution));
const gradId = $derived(`${classPrefix}-gamut-${axis}`);
const crossY = $derived(CHART_H - Math.min(1, Math.max(0, y)) * CHART_H);

function pick(event: PointerEvent & { currentTarget: SVGSVGElement }) {
  if (!onpick) return;
  const r = event.currentTarget.getBoundingClientRect();
  if (!r.width || !r.height) return;
  onpick((event.clientX - r.left) / r.width, (r.bottom - event.clientY) / r.height);
}
</script>

<svg
  class="{classPrefix}__chart{onpick ? ` ${classPrefix}__chart--interactive` : ''}"
  viewBox="0 0 {CHART_W} {CHART_H}"
  preserveAspectRatio="none"
  aria-hidden="true"
  focusable="false"
  onpointerdown={onpick
    ? (event) => {
        // Pointer capture keeps a drag alive once it leaves the chart, so the
        // value still tracks rather than sticking at the edge.
        event.currentTarget.setPointerCapture(event.pointerId);
        pick(event);
      }
    : undefined}
  onpointermove={onpick
    ? (event) => event.currentTarget.hasPointerCapture(event.pointerId) && pick(event)
    : undefined}
>
  <defs>
    <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
      {#each curve.stops as stop (stop.offset)}
        <stop offset="{stop.offset}%" stop-color={stop.hex} />
      {/each}
    </linearGradient>
  </defs>

  <path d="M0,{CHART_H} L{curve.path} L{CHART_W},{CHART_H} Z" fill="url(#{gradId})" />
  <path d="M{curve.path}" fill="none" class="{classPrefix}__chart-line" />

  <line x1={x * CHART_W} x2={x * CHART_W} y1="0" y2={CHART_H} class="{classPrefix}__crosshair" />
  <line x1="0" x2={CHART_W} y1={crossY} y2={crossY} class="{classPrefix}__crosshair" />
</svg>
