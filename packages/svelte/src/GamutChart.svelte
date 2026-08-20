<script lang="ts">
/** A 2D slice of the sRGB gamut: the chart holds one axis fixed and sweeps the
 * other two, so under the curve is displayable and above it is not. `$derived`
 * memoises the curve, so dragging an axis that does not feed it reuses the path
 * and its ~65 gradient stops. */
import type { Axis, Gamut } from "@oklch-picker/core";
import { CHART_H, CHART_W, chartBase, gamutChartModel, labelTransform } from "@oklch-picker/core";

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
  /** Called when a drag ends, so the caller can record the settled colour
   * rather than every value the gesture passed through. */
  onpicked?: () => void;
  /** Reference spaces to outline over the filled region. Omit for none. */
  references?: Gamut[] | undefined;
  /** The output space. The filled region is this gamut's reach, so a P3 picker
   * plots P3 rather than sRGB with an outline drawn over it. */
  gamut?: Gamut | undefined;
  /** Every space in view, drawn or not, which sets the vertical scale. */
  scaleGamuts?: Gamut[] | undefined;
  classPrefix: string;
  resolution?: number;
}

const {
  axis,
  curveKey,
  x,
  y,
  onpick,
  onpicked,
  references,
  gamut,
  scaleGamuts,
  classPrefix,
  resolution = 64,
}: Props = $props();

// The boundaries ride along in this memo rather than taking their own: they
// come from the same sweep, so a second `$derived` would walk the axis twice.
const curve = $derived(
  gamutChartModel(chartBase(curveKey, axis), axis, resolution, references, gamut, scaleGamuts),
);
const gradId = $derived(`${classPrefix}-gamut-${axis}`);
const crossY = $derived(CHART_H - Math.min(1, Math.max(0, y)) * CHART_H);

// The chart's rendered pixel size, for the labels' counter-scale. Measured
// rather than assumed: the chart is fluid, so the ratio moves with it. An
// attachment rather than an effect over `bind:this`, so the observer's life is
// tied to the node's own.
let width = $state(0);
let height = $state(0);
function measure(node: SVGSVGElement) {
  const observer = new ResizeObserver(([entry]) => {
    const r = entry?.contentRect;
    if (r) {
      width = r.width;
      height = r.height;
    }
  });
  observer.observe(node);
  return () => observer.disconnect();
}

function pick(event: PointerEvent & { currentTarget: SVGSVGElement }) {
  if (!onpick) return;
  const r = event.currentTarget.getBoundingClientRect();
  if (!r.width || !r.height) return;
  onpick((event.clientX - r.left) / r.width, (r.bottom - event.clientY) / r.height);
}
</script>

<svg
  {@attach measure}
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
  onpointerup={onpick ? () => onpicked?.() : undefined}
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
  {#each curve.boundaries as boundary (boundary.id)}
    <path
      d="M{boundary.path}"
      fill="none"
      class="{classPrefix}__gamut-boundary {classPrefix}__gamut-boundary--{boundary.id}"
    />
    <!-- Named on the line: a dashed outline with no label leaves the reader
         guessing which space it marks.

         The viewBox is stretched non-uniformly, so text placed straight into
         it is huge and squashed. `labelTransform` undoes the scale so the
         glyphs land at the size the stylesheet asks for. It is null until the
         chart has been measured, and no label beats a wrong one for a frame. -->
    {@const transform = labelTransform(boundary.labelX, boundary.labelY, width, height)}
    {#if transform}
      <g {transform}>
        <text class="{classPrefix}__gamut-label" text-anchor="middle" y="-5"
          >{boundary.label}</text>
      </g>
    {/if}
  {/each}

  <line x1={x * CHART_W} x2={x * CHART_W} y1="0" y2={CHART_H} class="{classPrefix}__crosshair" />
  <line x1="0" x2={CHART_W} y1={crossY} y2={crossY} class="{classPrefix}__crosshair" />
</svg>
