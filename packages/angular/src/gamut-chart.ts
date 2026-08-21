/** A 2D slice of the gamut: the chart holds one axis fixed and sweeps the other
 * two, so under the curve is displayable and above it is not. */
import { NgFor, NgIf } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import type { Axis, Gamut, Oklch } from "@oklch-picker/core";
import {
  CHART_H,
  CHART_W,
  chartBase,
  chartKey,
  gamutChartModel,
  labelTransform,
} from "@oklch-picker/core";

@Component({
  selector: "oklch-gamut-chart",
  standalone: true,
  imports: [NgFor, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `svg:` prefixes throughout: Angular parses this template as HTML, and an
  // unprefixed <path> in an HTML context is created in the XHTML namespace and
  // never paints.
  template: `
    <svg
      #svg
      [attr.class]="chartClass()"
      [attr.viewBox]="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up()"
    >
      <svg:defs>
        <svg:linearGradient [attr.id]="gradId()" x1="0" x2="1" y1="0" y2="0">
          <svg:stop
            *ngFor="let s of curve().stops; trackBy: trackStop"
            [attr.offset]="s.offset + '%'"
            [attr.stop-color]="s.hex"
          />
        </svg:linearGradient>
      </svg:defs>

      <svg:path [attr.d]="fillPath()" [attr.fill]="'url(#' + gradId() + ')'" />
      <svg:path [attr.d]="linePath()" fill="none" [attr.class]="prefix() + '__chart-line'" />

      <svg:g *ngFor="let b of curve().boundaries; trackBy: trackBoundary">
        <svg:path
          [attr.d]="'M' + b.path"
          fill="none"
          [attr.class]="boundaryClass(b.id)"
        />
        <!-- Named on the line, because a dashed outline with no label leaves the
             reader guessing which space it marks. The viewBox is stretched
             non-uniformly, so text placed straight into it is huge and squashed.
             labelTransform undoes the scale so the glyphs land at the size the
             stylesheet asks for. Null until the chart has been measured, since no
             label beats a wrong one for a frame. -->
        <svg:g *ngIf="labelAt(b) as t" [attr.transform]="t">
          <svg:text [attr.class]="prefix() + '__gamut-label'" text-anchor="middle" y="-5">
            {{ b.label }}
          </svg:text>
        </svg:g>
      </svg:g>

      <svg:line
        [attr.x1]="crossX()"
        [attr.x2]="crossX()"
        y1="0"
        [attr.y2]="chartH"
        [attr.class]="prefix() + '__crosshair'"
      />
      <svg:line
        x1="0"
        [attr.x2]="chartW"
        [attr.y1]="crossY()"
        [attr.y2]="crossY()"
        [attr.class]="prefix() + '__crosshair'"
      />
    </svg>
  `,
})
export class GamutChartComponent {
  readonly base = input.required<Oklch>();
  /** The axis held fixed; the chart sweeps the other two. */
  readonly axis = input.required<Axis>();
  /** Reference spaces to outline over the filled region. */
  readonly references = input<Gamut[] | undefined>(undefined);
  /** The output space. The filled region is this gamut's reach, so a P3 picker
   * plots P3 rather than sRGB with an outline drawn over it. */
  readonly gamut = input<Gamut | undefined>(undefined);
  /** Every space in view, drawn or not, which sets the vertical scale. */
  readonly scaleGamuts = input<Gamut[] | undefined>(undefined);
  /** 0..1 across the plot; drives the vertical crosshair. */
  readonly x = input.required<number>();
  /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
  readonly y = input.required<number>();
  /** Unique per instance. SVG gradient ids share a document-wide namespace. */
  readonly id = input.required<string>();
  /** Columns to sample. More is smoother; 64 costs well under a millisecond. */
  readonly resolution = input(64);
  /** Whether the chart responds to a pointer. A display-only chart still draws
   * the crosshair, it just does not move it. */
  readonly interactive = input(false);
  readonly prefix = input.required<string>();

  /** 0..1 plot coordinates as the pointer moves. */
  readonly pickAt = output<{ x: number; y: number }>();
  /** A drag ended, so the caller can record the settled colour rather than
   * every value the gesture passed through. */
  readonly picked = output<void>();

  readonly chartW = CHART_W;
  readonly chartH = CHART_H;
  readonly viewBox = `0 0 ${CHART_W} ${CHART_H}`;

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>("svg");

  /** The chart's rendered pixel size, for the label counter-scale. Observed
   * rather than assumed: the chart is fluid, and the ratio changes with it. */
  private readonly size = signal({ w: 0, h: 0 });

  constructor() {
    effect((onCleanup) => {
      // Angular runs effects during a server render, unlike React's useEffect
      // or Svelte's $effect, so this is the one adapter where the guard is
      // load-bearing. Without it the whole render dies on `ResizeObserver is
      // not defined` and the server sends an empty shell.
      //
      // Nothing is lost by skipping it: the size only feeds the boundary
      // labels' counter-scale, which stays null until the chart is measured,
      // and measuring cannot happen without a layout anyway.
      if (typeof ResizeObserver === "undefined") return;

      const node = this.svg().nativeElement;
      const observer = new ResizeObserver(([entry]) => {
        const r = entry?.contentRect;
        if (r) this.size.set({ w: r.width, h: r.height });
      });
      observer.observe(node);
      onCleanup(() => observer.disconnect());
    });
  }

  /** Keying on the axis the chart holds fixed means dragging either swept axis
   * reuses the curve and its ~65 gradient stops. A computed signal recomputes
   * only when one of the things it read actually changes, which is the same
   * bargain the other adapters strike with an explicit memo. */
  private readonly curveInput = computed(() => chartKey(this.base(), this.axis()));

  readonly curve = computed(() =>
    gamutChartModel(
      chartBase(this.curveInput(), this.axis()),
      this.axis(),
      this.resolution(),
      this.references(),
      this.gamut(),
      this.scaleGamuts(),
    ),
  );

  readonly gradId = computed(() => `${this.prefix()}-gamut-${this.id()}`);
  readonly fillPath = computed(
    () => `M0,${CHART_H} L${this.curve().path} L${CHART_W},${CHART_H} Z`,
  );
  readonly linePath = computed(() => `M${this.curve().path}`);
  readonly crossX = computed(() => this.x() * CHART_W);
  readonly crossY = computed(() => CHART_H - Math.min(1, Math.max(0, this.y())) * CHART_H);
  readonly chartClass = computed(() => {
    const p = this.prefix();
    return this.interactive() ? `${p}__chart ${p}__chart--interactive` : `${p}__chart`;
  });

  boundaryClass(id: string): string {
    const p = this.prefix();
    return `${p}__gamut-boundary ${p}__gamut-boundary--${id}`;
  }

  labelAt(b: { labelX: number; labelY: number }): string | null {
    const { w, h } = this.size();
    return labelTransform(b.labelX, b.labelY, w, h);
  }

  trackStop(_: number, s: { offset: number }): number {
    return s.offset;
  }

  trackBoundary(_: number, b: { id: string }): string {
    return b.id;
  }

  // Pointer capture keeps a drag alive once it leaves the chart, so the value
  // still tracks rather than sticking at the edge.
  down(e: PointerEvent): void {
    if (!this.interactive()) return;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    this.pick(e);
  }

  move(e: PointerEvent): void {
    if (!this.interactive()) return;
    if ((e.currentTarget as SVGSVGElement).hasPointerCapture(e.pointerId)) this.pick(e);
  }

  /** The release is the commit; the drag itself is a continuous preview. */
  up(): void {
    if (this.interactive()) this.picked.emit();
  }

  private pick(e: PointerEvent): void {
    const r = this.svg().nativeElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.pickAt.emit({
      x: (e.clientX - r.left) / r.width,
      y: (r.bottom - e.clientY) / r.height,
    });
  }
}
