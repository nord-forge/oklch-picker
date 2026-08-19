<script lang="ts">
/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import {
  type Axis,
  type Oklch,
  type PickerLayout,
  type PickerParts,
  chartPick,
  colourName,
  emitValue,
  hexToOklch,
  pickerModel,
  resolveCurrent,
  withSingleChart,
} from "@oklch-picker/core";
import GamutChart from "./GamutChart.svelte";

interface Props {
  /** `oklch(L C H)` or hex. Bindable, so `bind:value` works. */
  value?: string | null;
  /** Called with a canonical, gamut-clamped `oklch(L C H)` string. */
  onchange?: (colour: string) => void;
  presets?: string[];
  /** Visual arrangement. `chart` (the default) shows one large
   * lightness x chroma plot above all three sliders; `side-by-side` adds a right
   * rail for the readout and presets; `compact` drops the charts entirely and
   * inlines each label with its slider; `stacked` gives every axis its own
   * thin chart. */
  layout?: PickerLayout;
  /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
  parts?: PickerParts;
  /** Override for translation. */
  labels?: Partial<Record<Axis | "outOfGamut", string>>;
  /** Class prefix for every element, so styles can be overridden. */
  classPrefix?: string;
  class?: string;
}

let {
  value = $bindable(null),
  onchange,
  presets,
  layout,
  parts,
  labels,
  classPrefix = "oklch-picker",
  class: className,
}: Props = $props();

// What was dialled, not what was emitted: dragging through an out-of-gamut
// region must not destroy the other axes.
let draft = $state<Oklch | null>(null);

const model = $derived(pickerModel(resolveCurrent(draft, value), { layout, parts, labels }));
// `chart` renders one plot for the whole picker rather than one per axis.
const single = $derived(withSingleChart(model.layout) ? model.charts[0] : undefined);

function publish(colour: string) {
  value = colour;
  onchange?.(colour);
}
function dial(next: Oklch) {
  draft = next;
  publish(emitValue(next));
}
function pick(colour: string) {
  draft = null;
  publish(colour);
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

  {#if single}
    <GamutChart
      axis={single.axis}
      curveKey={single.key}
      x={single.x}
      y={single.y}
      onpick={(x, y) => dial(chartPick(model.current, single.axis, x, y))}
      {classPrefix}
    />
  {/if}

  <div class="{classPrefix}__axes">
    {#each model.axes as axis, i (axis.key)}
      <!-- In the `chart` layout the one chart is hoisted above the axes. -->
      {@const chart = single ? undefined : model.charts[i]}
      <!-- A div, not a label — the slider has its own aria-label. -->
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
          <input
            type="range"
            class="{classPrefix}__slider"
            min={axis.min}
            max={axis.max}
            step={axis.step}
            value={axis.value}
            aria-label={model.labels[axis.key]}
            oninput={(e) => dial({ ...model.current, [axis.key]: Number(e.currentTarget.value) })}
          />
        </span>
      </div>
    {/each}
  </div>

  {#if model.withFooter}
    <div class="{classPrefix}__footer">
      {#if model.parts.preview}
        <span
          class="{classPrefix}__preview"
          style:background={model.hex}
          style:color={model.light ? "#000" : "#fff"}
          title={model.clipped ? model.labels.outOfGamut : model.canonical}
        ></span>
      {/if}
      {#if model.parts.hexInput}
        <input
          class="{classPrefix}__hex"
          value={model.hex}
          spellcheck="false"
          aria-label="Hex colour"
          oninput={(e) => {
            const parsed = hexToOklch(e.currentTarget.value);
            if (parsed) dial(parsed);
          }}
        />
      {/if}
      {#if model.parts.name}
        <span class="{classPrefix}__name">{model.name}</span>
      {/if}
    </div>
  {/if}

  {#if model.parts.notice && model.clipped}
    <p class="{classPrefix}__notice">{model.labels.outOfGamut}</p>
  {/if}
</div>
