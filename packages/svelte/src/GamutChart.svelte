<script lang="ts">
/** One gamut chart. `$derived` memoises the curve, so dragging an axis that
 * does not feed it reuses the path and its ~65 gradient stops. */
import type { Axis } from "@oklch-picker/core";
import { CHART_H, CHART_W, chartBase, gamutChartModel } from "@oklch-picker/core";

interface Props {
  axis: Axis;
  /** Memo key: the single input this curve depends on. */
  curveKey: number;
  /** 0..1 along the axis; drives the vertical crosshair. */
  position: number;
  /** 0..1 of chart height; drives the horizontal crosshair. */
  chromaFraction: number;
  classPrefix: string;
  resolution?: number;
}

const { axis, curveKey, position, chromaFraction, classPrefix, resolution = 64 }: Props = $props();

const curve = $derived(gamutChartModel(chartBase(curveKey, axis), axis, resolution));
const gradId = $derived(`${classPrefix}-gamut-${axis}`);
const crossY = $derived(CHART_H - Math.min(1, Math.max(0, chromaFraction)) * CHART_H);
</script>

<svg
  class="{classPrefix}__chart"
  viewBox="0 0 {CHART_W} {CHART_H}"
  preserveAspectRatio="none"
  aria-hidden="true"
  focusable="false"
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

  <line
    x1={position * CHART_W}
    x2={position * CHART_W}
    y1="0"
    y2={CHART_H}
    class="{classPrefix}__crosshair"
  />
  <line x1="0" x2={CHART_W} y1={crossY} y2={crossY} class="{classPrefix}__crosshair" />
</svg>
