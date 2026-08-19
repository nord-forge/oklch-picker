<script lang="ts">
/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import {
  type Gamut,
  type LabelKey,
  type Oklch,
  type PickerLayout,
  type PickerParts,
  addRecent,
  chartPick,
  colourName,
  emitValue,
  pickerModel,
  resolveCurrent,
  toOklch,
  withSingleChart,
} from "@oklch-picker/core";
import GamutChart from "./GamutChart.svelte";

interface Props {
  /** `oklch(L C H)` or hex. Bindable, so `bind:value` works. */
  value?: string | null;
  /** Called with a canonical, gamut-clamped `oklch(L C H)` string. */
  onchange?: (colour: string) => void;
  presets?: string[];
  /** Recently used colours, most recent first. Omit to let the picker keep its
   * own list for the session; pass one to store them yourself, in a backend,
   * or shared between pickers. */
  recents?: string[];
  /** Called with the new list when a colour is committed, for the controlled
   * form above. Fires on commit, so on a pointer release, a preset, or a hex
   * entry. Not on every value a drag passes through. */
  onrecentschange?: (recents: string[]) => void;
  /** How many recents to keep. Ignored when `recents` is controlled: the list
   * you pass is the list that renders. */
  maxRecents?: number;
  /** Visual arrangement. `chart` (the default) shows one large
   * lightness x chroma plot above all three sliders; `side-by-side` adds a right
   * rail for the readout and presets; `compact` drops the charts entirely and
   * inlines each label with its slider; `stacked` gives every axis its own
   * thin chart. */
  layout?: PickerLayout;
  /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
  parts?: PickerParts;
  /** Override for translation. Keys are the three axes, `outOfGamut`, and
   * `outOf:<gamut id>` for a wider space's own notice. */
  labels?: Partial<Record<LabelKey, string>>;
  /** The output space: what the sliders reach, what is clamped, and what is
   * emitted. Defaults to sRGB. Import wider spaces from
   * `@oklch-picker/core/gamuts`; omitting this ships none of that code. */
  gamut?: Gamut;
  /** Spaces to outline on the charts without clamping to them. Defaults to
   * sRGB whenever `gamut` is wider, so the safe region stays visible. */
  references?: Gamut[];
  /** What the switcher offers, when `parts.gamutSwitch` is on. Defaults to the
   * output gamut plus its references. */
  gamutChoices?: Gamut[];
  /** Called when a switcher button is pressed. Omit to leave the buttons
   * inert. The app is driving `gamut` as a prop either way. */
  ongamutchange?: (gamut: Gamut) => void;
  /** Class prefix for every element, so styles can be overridden. */
  classPrefix?: string;
  class?: string;
}

let {
  value = $bindable(null),
  onchange,
  presets,
  recents: controlledRecents,
  onrecentschange,
  maxRecents,
  layout,
  parts,
  labels,
  gamut,
  references,
  gamutChoices,
  ongamutchange,
  classPrefix = "oklch-picker",
  class: className,
}: Props = $props();

// What was dialled, not what was emitted: dragging through an out-of-gamut
// region must not destroy the other axes.
let draft = $state<Oklch | null>(null);

// The output space decides what `resolveCurrent` compares against, so it is
// read from the prop here rather than from the model it feeds.
const model = $derived(
  pickerModel(resolveCurrent(draft, value, gamut), {
    layout,
    parts,
    labels,
    gamut,
    references,
    gamutChoices,
  }),
);
// `chart` renders one plot for the whole picker rather than one per axis.
const single = $derived(withSingleChart(model.layout) ? model.charts[0] : undefined);

function publish(colour: string) {
  value = colour;
  onchange?.(colour);
}
function dial(next: Oklch) {
  draft = next;
  publish(emitValue(next, model.gamut));
}
// Recents are uncontrolled until `recents` is passed, mirroring how `value`
// works. The internal list is kept regardless so switching to controlled
// mid-session does not lose it.
let ownRecents = $state<string[]>([]);
const recents = $derived(controlledRecents ?? ownRecents);

// A drag calls `onchange` for every value it passes through, so recording
// there would bury the list in near-identical colours from one gesture. Only a
// commit lands here. That is a pointer release, a preset or a hex entry.
function commit(colour: string) {
  const next = addRecent(recents, colour, maxRecents);
  ownRecents = next;
  onrecentschange?.(next);
}
function commitCurrent() {
  commit(emitValue(model.current, model.gamut));
}
function pick(colour: string) {
  draft = null;
  publish(colour);
  commit(colour);
}

// `toOklch` rather than a per-field parser: a field accepts any supported
// format whichever one it shows, so pasting a hex into the oklch field works
// instead of being a rule to learn.
function editColour(event: Event & { currentTarget: HTMLInputElement }) {
  const parsed = toOklch(event.currentTarget.value);
  if (parsed) dial(parsed);
}

// Fully opaque drops the key rather than storing `a: 1`, so a colour dragged
// back to opaque emits `oklch(L C H)` and not `oklch(L C H / 1)`. One shape
// for "opaque", set in one place.
function slideAlpha(event: Event & { currentTarget: HTMLInputElement }) {
  const a = Number(event.currentTarget.value);
  const { a: _drop, ...rest } = model.current;
  dial(a >= 1 ? rest : { ...rest, a });
}
</script>

<div class={[classPrefix, `${classPrefix}--${model.layout}`, className].filter(Boolean).join(" ")}>
  {#if presets && presets.length > 0}
    <div class="{classPrefix}__presets">
      {#each presets as preset (preset)}
        {@const selected = preset === model.canonical}
        <button
          type="button"
          class="{classPrefix}__preset{selected ? ` ${classPrefix}__preset--selected` : ''}"
          style:background={preset}
          aria-label={colourName(preset)}
          aria-pressed={selected}
          onclick={() => pick(preset)}
        ></button>
      {/each}
    </div>
  {/if}

  {#if model.parts.recents && recents.length > 0}
    <div class="{classPrefix}__recents">
      {#each recents as recent (recent)}
        {@const selected = recent === model.canonical}
        <button
          type="button"
          class="{classPrefix}__recent{selected ? ` ${classPrefix}__recent--selected` : ''}"
          style:background={recent}
          aria-label="Recent: {colourName(recent)}"
          aria-pressed={selected}
          onclick={() => pick(recent)}
        ></button>
      {/each}
    </div>
  {/if}

  {#if single}
    <GamutChart
      axis={single.axis}
      curveKey={single.key}
      x={single.x}
      y={single.y}
      references={model.references}
      onpick={(x, y) => dial(chartPick(model.current, single.axis, x, y))}
      onpicked={commitCurrent}
      {classPrefix}
    />
  {/if}

  <div class="{classPrefix}__axes">
    {#each model.axes as axis, i (axis.key)}
      <!-- In the `chart` layout the one chart is hoisted above the axes. -->
      {@const chart = single ? undefined : model.charts[i]}
      <!-- A div, not a label. The slider has its own aria-label. -->
      <div class="{classPrefix}__axis">
        <span class="{classPrefix}__axis-head">
          <span class="{classPrefix}__axis-label" aria-hidden="true">
            {model.layout === "compact" ? axis.key.toUpperCase() : model.labels[axis.key]}
          </span>
          <output class="{classPrefix}__axis-value">
            {axis.key === "h" ? Math.round(axis.value) : axis.value.toFixed(2)}
          </output>
        </span>

        <!-- Read-only here: a 34px strip gives a drag almost no vertical
             travel, and it would set two axes at once right above the slider
             that sets one precisely. Only `chart` is big enough. -->
        {#if chart}
          <GamutChart
            axis={chart.axis}
            curveKey={chart.key}
            x={chart.x}
            y={chart.y}
            references={model.references}
            {classPrefix}
          />
        {/if}

        <span class="{classPrefix}__track">
          <span class="{classPrefix}__track-fill" style:background={model.gradients[i]}>
            {#each model.spans[i] ?? [] as span (span.start)}
              <span
                class="{classPrefix}__out-of-gamut"
                style:left="{span.start * 100}%"
                style:width="{(span.end - span.start) * 100}%"
              ></span>
            {/each}
          </span>
          <!-- The gesture ending is the commit, not each value it passed
               through. `blur` catches the keyboard: arrowing along a slider
               should record once the user moves on, not per step. -->
          <input
            type="range"
            class="{classPrefix}__slider"
            min={axis.min}
            max={axis.max}
            step={axis.step}
            value={axis.value}
            aria-label={model.labels[axis.key]}
            oninput={(e) => dial({ ...model.current, [axis.key]: Number(e.currentTarget.value) })}
            onpointerup={commitCurrent}
            onblur={commitCurrent}
          />
        </span>
      </div>
    {/each}

    <!-- Alpha rides with the axes for layout but is not one of them. It has no
         gamut chart and no hatching, because transparency cannot put a colour
         outside what a screen can show. -->
    {#if model.withAlpha}
      <div class="{classPrefix}__axis {classPrefix}__alpha">
        <span class="{classPrefix}__axis-head">
          <span class="{classPrefix}__axis-label" aria-hidden="true">
            {model.layout === "compact" ? "A" : "Alpha"}
          </span>
          <output class="{classPrefix}__axis-value">{model.alpha.value.toFixed(2)}</output>
        </span>

        <span class="{classPrefix}__track">
          <span class="{classPrefix}__track-fill">
            <span class="{classPrefix}__alpha-check"></span>
            <span class="{classPrefix}__alpha-ramp" style:background={model.alpha.track}></span>
          </span>
          <input
            type="range"
            class="{classPrefix}__slider"
            min={model.alpha.min}
            max={model.alpha.max}
            step={model.alpha.step}
            value={model.alpha.value}
            aria-label="Alpha"
            oninput={slideAlpha}
            onpointerup={commitCurrent}
            onblur={commitCurrent}
          />
        </span>
      </div>
    {/if}
  </div>

  {#if model.withGamutSwitch}
    <div class="{classPrefix}__gamut-switch" role="group" aria-label="Output gamut">
      {#each model.gamutChoices as choice (choice.id)}
        <button
          type="button"
          class="{classPrefix}__gamut-choice"
          aria-pressed={choice.id === model.gamut.id}
          aria-label="Output in {choice.label}"
          onclick={() => ongamutchange?.(choice)}
        >
          {choice.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if model.withFooter}
    <div class="{classPrefix}__footer">
      {#if model.parts.preview}
        <span
          class="{classPrefix}__preview"
          style:background={model.hex}
          style:color={model.light ? "#000" : "#fff"}
          title={model.clipped ? model.notice : model.canonical}
        ></span>
      {/if}
      <!-- Every field accepts any supported format, whichever it displays.
           Pasting a hex into the oklch field works, because refusing it would
           be a rule the reader has to learn for no benefit. Typing passes
           through half-entered colours, so the commit is leaving the field
           rather than each keystroke. -->
      {#if model.parts.oklchInput}
        <input
          class="{classPrefix}__field {classPrefix}__field--oklch"
          value={model.oklch}
          spellcheck="false"
          aria-label="OKLCH colour"
          oninput={editColour}
          onblur={commitCurrent}
        />
      {/if}
      {#if model.parts.rgbInput}
        <input
          class="{classPrefix}__field {classPrefix}__field--rgb"
          value={model.rgb}
          spellcheck="false"
          aria-label="RGB colour"
          oninput={editColour}
          onblur={commitCurrent}
        />
      {/if}
      {#if model.parts.hexInput}
        <!-- The legacy `__hex` class stays alongside the new one: existing
             tests and consumer CSS target it. -->
        <input
          class="{classPrefix}__field {classPrefix}__field--hex {classPrefix}__hex"
          value={model.hex}
          spellcheck="false"
          aria-label="Hex colour"
          oninput={editColour}
          onblur={commitCurrent}
        />
      {/if}
      {#if model.parts.name}
        <span class="{classPrefix}__name">{model.name}</span>
      {/if}
    </div>
  {/if}

  {#if model.parts.notice && model.clipped}
    <p class="{classPrefix}__notice">{model.notice}</p>
  {/if}
</div>
