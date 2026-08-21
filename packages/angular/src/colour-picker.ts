/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import { NgFor, NgIf } from "@angular/common";
import {
  APP_ID,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import type { Axis, Gamut, LabelKey, Oklch, PickerLayout, PickerParts } from "@oklch-picker/core";
import {
  addRecent,
  chartPick,
  colourName,
  emitValue,
  pickerModel,
  recentValue,
  resolveCurrent,
  toOklch,
  withSingleChart,
} from "@oklch-picker/core";
import { GamutChartComponent } from "./gamut-chart.js";

/** Counts per application, not per module.
 *
 * Angular has no `useId`, so this used to be a bare module counter. That is
 * safe in a browser, where the module is loaded once per document, and wrong
 * on a server: the counter lives as long as the process, so request 1 renders
 * `a0` and request 500 renders `a500`, while the browser bootstrapping that
 * page starts from `a0` again. The uid feeds the SVG gradient id, so the
 * server's markup pointed at `url(#a500-h)` and the client rebuilt
 * `url(#a0-h)`, and the chart's fill broke on hydration.
 *
 * Keyed on the root injector rather than on `APP_ID`, which defaults to `"ng"`
 * for every app and so would share one counter across every request on the
 * server. Each server render gets its own injector, so each starts from 1 and
 * agrees with the client that resumes it. A `WeakMap` lets a finished request's
 * injector be collected with its count. `APP_ID` still goes in the id itself,
 * to keep two apps on one page apart. */
const instancesByApp = new WeakMap<object, { n: number }>();

function nextUid(scope: object, appId: string): string {
  let count = instancesByApp.get(scope);
  if (!count) {
    count = { n: 0 };
    instancesByApp.set(scope, count);
  }
  count.n += 1;
  return `${appId}-${count.n}`;
}

@Component({
  selector: "oklch-colour-picker",
  standalone: true,
  imports: [NgFor, NgIf, GamutChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [attr.class]="rootClass()">
      <div [attr.class]="prefix() + '__presets'" *ngIf="hasPresets()">
        <button
          *ngFor="let p of presets(); trackBy: trackColour"
          type="button"
          [attr.class]="presetClass(p)"
          [style.background]="p"
          [attr.aria-label]="name(p)"
          [attr.aria-pressed]="p === model().canonical"
          (click)="pick(p)"
        ></button>
      </div>

      <div [attr.class]="prefix() + '__recents'" *ngIf="model().parts.recents && recents().length">
        <p [attr.class]="prefix() + '__swatch-label'">{{ model().labels.recents }}</p>
        <button
          *ngFor="let r of recents(); trackBy: trackColour"
          type="button"
          [attr.class]="recentClass(r)"
          [style.background]="r"
          [attr.aria-label]="'Recent: ' + name(r)"
          [attr.aria-pressed]="r === model().canonical"
          (click)="pick(r)"
        ></button>
      </div>

      <oklch-gamut-chart
        *ngIf="single() as s"
        [base]="current()"
        [axis]="s.axis"
        [id]="uid + '-' + s.axis"
        [x]="s.x"
        [y]="s.y"
        [references]="model().references"
        [gamut]="model().gamut"
        [scaleGamuts]="model().scaleGamuts"
        [interactive]="true"
        [prefix]="prefix()"
        (pickAt)="chartPickAt(s.axis, $event)"
        (picked)="commitCurrent()"
      />

      <div [attr.class]="prefix() + '__axes'">
        <div
          *ngFor="let a of model().axes; let i = index; trackBy: trackAxis"
          [attr.class]="prefix() + '__axis'"
        >
          <span [attr.class]="prefix() + '__axis-head'">
            <span [attr.class]="prefix() + '__axis-label'" aria-hidden="true">
              {{ axisLabel(a.key) }}
            </span>
            <output [attr.class]="prefix() + '__axis-value'">{{ axisValue(a) }}</output>
          </span>

          <!-- Read-only here: a 34px strip gives a drag almost no vertical
               travel, and it would set two axes at once right above the slider
               that sets one precisely. Only chart is big enough. -->
          <oklch-gamut-chart
            *ngIf="chartFor(i) as c"
            [base]="current()"
            [axis]="a.key"
            [id]="uid + '-' + a.key"
            [x]="c.x"
            [y]="c.y"
            [references]="model().references"
            [gamut]="model().gamut"
            [scaleGamuts]="model().scaleGamuts"
            [prefix]="prefix()"
          />

          <span [attr.class]="prefix() + '__track'">
            <span [attr.class]="prefix() + '__track-fill'" [style.background]="model().gradients[i]">
              <span
                *ngFor="let s of model().spans[i]; trackBy: trackSpan"
                [attr.class]="prefix() + '__out-of-gamut'"
                [style.left.%]="s.start * 100"
                [style.width.%]="(s.end - s.start) * 100"
              ></span>
            </span>
            <input
              type="range"
              [attr.class]="prefix() + '__slider'"
              [attr.min]="a.min"
              [attr.max]="a.max"
              [attr.step]="a.step"
              [value]="a.value"
              [attr.aria-label]="model().labels[a.key]"
              [attr.aria-valuetext]="a.valuetext"
              (input)="slide(a.key, $event)"
              (pointerup)="commitCurrent()"
              (blur)="commitCurrent()"
            />
          </span>
        </div>

        <!-- Alpha rides with the axes for layout but is not one of them. It has
             no gamut chart and no hatching, because transparency cannot put a
             colour outside what a screen can show. -->
        <div [attr.class]="prefix() + '__axis ' + prefix() + '__alpha'" *ngIf="model().withAlpha">
          <span [attr.class]="prefix() + '__axis-head'">
            <span [attr.class]="prefix() + '__axis-label'" aria-hidden="true">
              {{ model().layout === "compact" ? "A" : "Alpha" }}
            </span>
            <output [attr.class]="prefix() + '__axis-value'">
              {{ model().alpha.value.toFixed(2) }}
            </output>
          </span>

          <span [attr.class]="prefix() + '__track'">
            <span [attr.class]="prefix() + '__track-fill'">
              <span [attr.class]="prefix() + '__alpha-check'"></span>
              <span
                [attr.class]="prefix() + '__alpha-ramp'"
                [style.background]="model().alpha.track"
              ></span>
            </span>
            <input
              type="range"
              [attr.class]="prefix() + '__slider'"
              [attr.min]="model().alpha.min"
              [attr.max]="model().alpha.max"
              [attr.step]="model().alpha.step"
              [value]="model().alpha.value"
              aria-label="Alpha"
              [attr.aria-valuetext]="model().alpha.valuetext"
              (input)="slideAlpha($event)"
              (pointerup)="commitCurrent()"
              (blur)="commitCurrent()"
            />
          </span>
        </div>
      </div>

      <div
        [attr.class]="prefix() + '__gamut-switch'"
        role="group"
        aria-label="Output gamut"
        *ngIf="model().withGamutSwitch"
      >
        <button
          *ngFor="let g of model().gamutChoices; trackBy: trackGamut"
          type="button"
          [attr.class]="prefix() + '__gamut-choice'"
          [attr.aria-pressed]="g.id === model().gamut.id"
          [attr.aria-label]="'Output in ' + g.label"
          (click)="gamutChange.emit(g)"
        >
          {{ g.label }}
        </button>
      </div>

      <div [attr.class]="prefix() + '__footer'" *ngIf="model().withFooter">
        <span
          *ngIf="model().parts.preview"
          [attr.class]="prefix() + '__preview'"
          [style.background]="model().hex"
          [style.color]="model().light ? '#000' : '#fff'"
          [attr.title]="model().clipped ? model().notice : model().canonical"
        ></span>
        <!-- Every field accepts any supported format, whichever it displays.
             Pasting a hex into the oklch field works, because refusing it would
             be a rule the reader has to learn for no benefit. -->
        <input
          *ngIf="model().parts.oklchInput"
          [attr.class]="prefix() + '__field ' + prefix() + '__field--oklch'"
          [value]="model().oklch"
          spellcheck="false"
          aria-label="OKLCH colour"
          (input)="editColour($event)"
          (blur)="commitCurrent()"
        />
        <input
          *ngIf="model().parts.rgbInput"
          [attr.class]="prefix() + '__field ' + prefix() + '__field--rgb'"
          [value]="model().rgb"
          spellcheck="false"
          aria-label="RGB colour"
          (input)="editColour($event)"
          (blur)="commitCurrent()"
        />
        <!-- The commit is leaving the field rather than each keystroke, since
             typing passes through half-entered colours. -->
        <input
          *ngIf="model().parts.hexInput"
          [attr.class]="hexFieldClass()"
          [value]="model().hex"
          spellcheck="false"
          aria-label="Hex colour"
          (input)="editColour($event)"
          (blur)="commitCurrent()"
        />
        <span *ngIf="model().parts.name" [attr.class]="prefix() + '__name'">{{ model().name }}</span>
      </div>

      <!-- Always rendered, empty until something is clipped: a live region only
           announces if it was in the DOM before the text arrived. -->
      <!-- On one line, and the interpolation flush against the tags: Angular
           keeps the whitespace around it as part of the text node, so a broken
           up tag leaves an "empty" notice holding spaces. -->
      <p [attr.class]="prefix() + '__notice'" role="status" *ngIf="model().parts.notice">{{ model().clipped ? model().notice : "" }}</p>
    </div>
  `,
})
export class ColourPickerComponent {
  /** `oklch(L C H)` or hex. */
  readonly value = input<string | null | undefined>(undefined);
  readonly presets = input<string[] | undefined>(undefined);
  /** Recently used colours, most recent first. Omit to let the picker keep its
   * own list for the session; pass one to store them yourself, in a backend, or
   * shared between pickers. */
  readonly recentsInput = input<string[] | undefined>(undefined, { alias: "recents" });
  /** How many recents to keep. Ignored when `recents` is controlled: the list
   * you pass is the list that renders. */
  readonly maxRecents = input<number | undefined>(undefined);
  /** Visual arrangement. `chart` (the default) shows one large
   * lightness x chroma plot above all three sliders; `side-by-side` adds a
   * right rail for the readout and presets; `compact` drops the charts entirely
   * and inlines each label with its slider; `stacked` gives every axis its own
   * thin chart. */
  readonly layout = input<PickerLayout | undefined>(undefined);
  /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
  readonly parts = input<PickerParts | undefined>(undefined);
  /** Override for translation. Keys are the three axes, `outOfGamut`, and
   * `outOf:<gamut id>` for a wider space's own notice. */
  readonly labels = input<Partial<Record<LabelKey, string>> | undefined>(undefined);
  /** The output space: what the sliders reach, what is clamped, and what is
   * emitted. Defaults to sRGB. Import wider spaces from
   * `@oklch-picker/core/gamuts`; omitting this ships none of that code. */
  readonly gamut = input<Gamut | undefined>(undefined);
  /** Spaces to outline on the charts without clamping to them. Defaults to sRGB
   * whenever `gamut` is wider, so the safe region stays visible. */
  readonly references = input<Gamut[] | undefined>(undefined);
  /** What the switcher offers, when `parts.gamutSwitch` is on. Defaults to the
   * output gamut plus its references. */
  readonly gamutChoices = input<Gamut[] | undefined>(undefined);
  /** Class prefix for every element, so styles can be overridden. */
  readonly classPrefix = input("oklch-picker");
  readonly class = input<string | undefined>(undefined);

  /** A canonical, gamut-clamped `oklch(L C H)` string. */
  readonly valueChange = output<string>();
  /** The new list when a colour is committed, for the controlled form above.
   * Fires on commit, so on a pointer release, a preset, or a text entry. Not on
   * every value a drag passes through. */
  readonly recentsChange = output<string[]>();
  /** A switcher button was pressed. The app is driving `gamut` as an input
   * either way. */
  readonly gamutChange = output<Gamut>();

  // SVG ids share one document-wide namespace, so two pickers on a page both
  // emitting `oklch-picker-gamut-h` made the second chart fill from the first
  // one's gradient.
  readonly uid = nextUid(inject(EnvironmentInjector), inject(APP_ID));

  /** What was dialled, not what was emitted: dragging through an out-of-gamut
   * region must not destroy the other axes. */
  private readonly draft = signal<Oklch | null>(null);

  /** Recents are uncontrolled until `recents` is passed, mirroring how `value`
   * works. The internal list is kept regardless so switching to controlled
   * mid-session does not lose it. */
  private readonly ownRecents = signal<string[]>([]);

  readonly prefix = computed(() => this.classPrefix());
  readonly recents = computed(() => this.recentsInput() ?? this.ownRecents());

  /** The output space decides what `resolveCurrent` compares against, so it is
   * read from the input here rather than from the model it feeds. */
  readonly current = computed(() => resolveCurrent(this.draft(), this.value(), this.gamut()));

  readonly model = computed(() =>
    pickerModel(this.current(), {
      layout: this.layout(),
      parts: this.parts(),
      labels: this.labels(),
      gamut: this.gamut(),
      references: this.references(),
      gamutChoices: this.gamutChoices(),
    }),
  );

  /** `chart` renders one plot for the whole picker rather than one per axis. */
  readonly single = computed(() =>
    withSingleChart(this.model().layout) ? this.model().charts[0] : undefined,
  );

  readonly rootClass = computed(() =>
    [this.prefix(), `${this.prefix()}--${this.model().layout}`, this.class()]
      .filter(Boolean)
      .join(" "),
  );

  readonly hasPresets = computed(() => (this.presets()?.length ?? 0) > 0);
  readonly hexFieldClass = computed(() => {
    const p = this.prefix();
    return `${p}__field ${p}__field--hex ${p}__hex`;
  });

  /** In the `chart` layout the one chart is hoisted above the axes. */
  chartFor(i: number) {
    return this.single() ? undefined : this.model().charts[i];
  }

  axisLabel(key: Axis): string {
    return this.model().layout === "compact" ? key.toUpperCase() : this.model().labels[key];
  }

  axisValue(a: { key: Axis; value: number }): string {
    return a.key === "h" ? String(Math.round(a.value)) : a.value.toFixed(2);
  }

  presetClass(p: string): string {
    const base = `${this.prefix()}__preset`;
    return p === this.model().canonical ? `${base} ${base}--selected` : base;
  }

  recentClass(r: string): string {
    const base = `${this.prefix()}__recent`;
    return r === this.model().canonical ? `${base} ${base}--selected` : base;
  }

  name(colour: string): string {
    return colourName(colour);
  }

  trackColour(_: number, c: string): string {
    return c;
  }

  trackAxis(_: number, a: { key: Axis }): string {
    return a.key;
  }

  trackSpan(_: number, s: { start: number }): number {
    return s.start;
  }

  trackGamut(_: number, g: { id: string }): string {
    return g.id;
  }

  private emit(next: Oklch): void {
    this.draft.set(next);
    this.valueChange.emit(emitValue(next, this.model().gamut));
  }

  /** A drag calls `valueChange` for every value it passes through, so recording
   * there would bury the list in near-identical colours from one gesture. Only
   * a commit lands here. That is a pointer release, a preset or a text entry. */
  private commit(colour: string): void {
    const next = addRecent(this.recents(), colour, this.maxRecents());
    this.ownRecents.set(next);
    this.recentsChange.emit(next);
  }

  /** Null while the dialled colour is outside the gamut, so a drag released in
   * a hatched region records nothing rather than the clamped near-miss. */
  commitCurrent(): void {
    const colour = recentValue(this.current(), this.model().gamut);
    if (colour) this.commit(colour);
  }

  pick(colour: string): void {
    this.draft.set(null);
    this.valueChange.emit(colour);
    this.commit(colour);
  }

  slide(key: Axis, e: Event): void {
    this.emit({ ...this.current(), [key]: Number((e.target as HTMLInputElement).value) });
  }

  /** Fully opaque drops the key rather than storing `a: 1`, so a colour dragged
   * to opaque emits `oklch(L C H)` and not `oklch(L C H / 1)`. One shape for
   * "opaque", set in one place. */
  slideAlpha(e: Event): void {
    const a = Number((e.target as HTMLInputElement).value);
    const { a: _drop, ...rest } = this.current();
    this.emit(a >= 1 ? rest : { ...rest, a });
  }

  /** `toOklch` rather than a per-field parser: a field accepts any supported
   * format whichever one it shows, so pasting a hex into the oklch field works
   * instead of being a rule to learn. */
  editColour(e: Event): void {
    const parsed = toOklch((e.target as HTMLInputElement).value);
    if (parsed) this.emit(parsed);
  }

  chartPickAt(axis: Axis, at: { x: number; y: number }): void {
    const m = this.model();
    this.emit(chartPick(this.current(), axis, at.x, at.y, m.gamut, m.scaleGamuts));
  }
}
