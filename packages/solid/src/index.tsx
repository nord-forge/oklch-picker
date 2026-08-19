/**
 * Solid adapter. Props are read lazily throughout — destructuring at the top
 * of a Solid component would snapshot them and break reactivity.
 */
import {
  type Axis,
  CHART_H,
  CHART_W,
  type ChartSlot,
  type Gamut,
  type LabelKey,
  type Oklch,
  type PickerLayout,
  type PickerParts,
  chartBase,
  chartPick,
  colourName,
  emitValue,
  gamutChartModel,
  hexToOklch,
  pickerModel,
  resolveCurrent,
  withSingleChart,
} from "@oklch-picker/core";
import { For, Show, createMemo, createSignal } from "solid-js";

interface GamutChartProps {
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
  onPick?: (x: number, y: number) => void;
  /** Reference spaces to outline over the filled region. Omit for none. */
  references?: Gamut[] | undefined;
  classPrefix: string;
  resolution?: number;
}

/** One gamut chart: a 2D slice of the sRGB gamut, holding one axis fixed and
 * sweeping the other two, so under the curve is displayable and above it is
 * not. `createMemo` on the curve means dragging an axis that does not feed it
 * reuses the path and its ~65 gradient stops. */
function GamutChart(props: GamutChartProps) {
  // The boundaries ride along in this memo rather than taking their own: they
  // come from the same sweep, so a second memo would walk the axis twice.
  const curve = createMemo(() =>
    gamutChartModel(
      chartBase(props.curveKey, props.axis),
      props.axis,
      props.resolution ?? 64,
      props.references,
    ),
  );
  const gradId = () => `${props.classPrefix}-gamut-${props.axis}`;
  const crossY = () => CHART_H - Math.min(1, Math.max(0, props.y)) * CHART_H;

  // Pointer capture keeps a drag alive once it leaves the chart, so the value
  // still tracks rather than sticking at the edge.
  const pick = (e: PointerEvent & { currentTarget: SVGSVGElement }) => {
    const onPick = props.onPick;
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    onPick((e.clientX - r.left) / r.width, (r.bottom - e.clientY) / r.height);
  };

  return (
    <svg
      class={`${props.classPrefix}__chart${props.onPick ? ` ${props.classPrefix}__chart--interactive` : ""}`}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      // `focusable="false"` is omitted here, unlike the other adapters: it is a
      // legacy IE attribute Solid's JSX types do not model, and `aria-hidden`
      // already keeps the chart out of the accessibility tree.
      aria-hidden="true"
      onPointerDown={(e) => {
        if (!props.onPick) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => {
        if (props.onPick && e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
      }}
    >
      <defs>
        <linearGradient id={gradId()} x1="0" x2="1" y1="0" y2="0">
          <For each={curve().stops}>
            {(s) => <stop offset={`${s.offset}%`} stop-color={s.hex} />}
          </For>
        </linearGradient>
      </defs>

      <path
        d={`M0,${CHART_H} L${curve().path} L${CHART_W},${CHART_H} Z`}
        fill={`url(#${gradId()})`}
      />
      <path d={`M${curve().path}`} fill="none" class={`${props.classPrefix}__chart-line`} />
      <For each={curve().boundaries}>
        {(b) => (
          <path
            d={`M${b.path}`}
            fill="none"
            class={`${props.classPrefix}__gamut-boundary ${props.classPrefix}__gamut-boundary--${b.id}`}
          />
        )}
      </For>

      <line
        x1={props.x * CHART_W}
        x2={props.x * CHART_W}
        y1="0"
        y2={CHART_H}
        class={`${props.classPrefix}__crosshair`}
      />
      <line
        x1="0"
        x2={CHART_W}
        y1={crossY()}
        y2={crossY()}
        class={`${props.classPrefix}__crosshair`}
      />
    </svg>
  );
}

export interface ColourPickerProps {
  /** `oklch(L C H)` or hex. */
  value: string | null | undefined;
  /** Called with a canonical, gamut-clamped `oklch(L C H)` string. */
  onChange: (colour: string) => void;
  presets?: string[];
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
  /** Called when a switcher button is pressed. Omit to leave the buttons inert
   * — the app is driving `gamut` as a prop either way. */
  onGamutChange?: (gamut: Gamut) => void;
  /** Class prefix for every element, so styles can be overridden. */
  classPrefix?: string;
  class?: string;
}

export function ColourPicker(props: ColourPickerProps) {
  const prefix = () => props.classPrefix ?? "oklch-picker";
  // What was dialled, not what was emitted: dragging through an out-of-gamut
  // region must not destroy the other axes.
  const [draft, setDraft] = createSignal<Oklch | null>(null);

  // The output space decides what `resolveCurrent` compares against, so it is
  // read from the prop here rather than from the model it feeds.
  const model = createMemo(() =>
    pickerModel(resolveCurrent(draft(), props.value, props.gamut), {
      layout: props.layout,
      parts: props.parts,
      labels: props.labels,
      gamut: props.gamut,
      references: props.references,
      gamutChoices: props.gamutChoices,
    }),
  );

  // `chart` renders one plot for the whole picker rather than one per axis.
  const single = (): ChartSlot | undefined =>
    withSingleChart(model().layout) ? model().charts[0] : undefined;

  const dial = (next: Oklch) => {
    setDraft(next);
    props.onChange(emitValue(next, model().gamut));
  };
  const pick = (colour: string) => {
    setDraft(null);
    props.onChange(colour);
  };

  return (
    <div
      class={[prefix(), `${prefix()}--${model().layout}`, props.class].filter(Boolean).join(" ")}
    >
      <Show when={props.presets && props.presets.length > 0}>
        <div class={`${prefix()}__presets`}>
          <For each={props.presets}>
            {(colour) => {
              const selected = () => colour === model().canonical;
              return (
                <button
                  type="button"
                  class={`${prefix()}__preset${selected() ? ` ${prefix()}__preset--selected` : ""}`}
                  style={{ background: colour }}
                  aria-label={colourName(colour)}
                  aria-pressed={selected()}
                  onClick={() => pick(colour)}
                />
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={single()}>
        {(slot) => (
          <GamutChart
            axis={slot().axis}
            curveKey={slot().key}
            x={slot().x}
            y={slot().y}
            references={model().references}
            onPick={(x, y) => dial(chartPick(model().current, slot().axis, x, y))}
            classPrefix={prefix()}
          />
        )}
      </Show>

      <div class={`${prefix()}__axes`}>
        <For each={model().axes}>
          {(a, i) => {
            // In the `chart` layout the one chart is hoisted above the axes.
            const chart = (): ChartSlot | undefined => (single() ? undefined : model().charts[i()]);
            // A div, not a label — the slider has its own aria-label.
            return (
              <div class={`${prefix()}__axis`}>
                <span class={`${prefix()}__axis-head`}>
                  <span class={`${prefix()}__axis-label`} aria-hidden="true">
                    {model().layout === "compact" ? a.key.toUpperCase() : model().labels[a.key]}
                  </span>
                  <output class={`${prefix()}__axis-value`}>
                    {a.key === "h" ? Math.round(a.value) : a.value.toFixed(2)}
                  </output>
                </span>

                {/* Read-only here: a 34px strip gives a drag almost no vertical
                    travel, and it would set two axes at once right above the
                    slider that sets one precisely. Only `chart` is big enough. */}
                <Show when={chart()}>
                  {(slot) => (
                    <GamutChart
                      axis={slot().axis}
                      curveKey={slot().key}
                      x={slot().x}
                      y={slot().y}
                      references={model().references}
                      classPrefix={prefix()}
                    />
                  )}
                </Show>

                <span class={`${prefix()}__track`}>
                  <span
                    class={`${prefix()}__track-fill`}
                    style={{ background: model().gradients[i()] }}
                  >
                    <For each={model().spans[i()]}>
                      {(s) => (
                        <span
                          class={`${prefix()}__out-of-gamut`}
                          style={{
                            left: `${s.start * 100}%`,
                            width: `${(s.end - s.start) * 100}%`,
                          }}
                        />
                      )}
                    </For>
                  </span>
                  <input
                    type="range"
                    class={`${prefix()}__slider`}
                    min={a.min}
                    max={a.max}
                    step={a.step}
                    value={a.value}
                    aria-label={model().labels[a.key]}
                    onInput={(e) =>
                      dial({ ...model().current, [a.key]: Number(e.currentTarget.value) })
                    }
                  />
                </span>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={model().withGamutSwitch}>
        {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form
            controls and brings a legend and its own box; this is a toolbar of
            buttons, which is what role="group" describes. */}
        <div class={`${prefix()}__gamut-switch`} role="group" aria-label="Output gamut">
          <For each={model().gamutChoices}>
            {(g) => (
              <button
                type="button"
                class={`${prefix()}__gamut-choice`}
                aria-pressed={g.id === model().gamut.id}
                aria-label={`Output in ${g.label}`}
                onClick={() => props.onGamutChange?.(g)}
              >
                {g.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={model().withFooter}>
        <div class={`${prefix()}__footer`}>
          <Show when={model().parts.preview}>
            <span
              class={`${prefix()}__preview`}
              style={{ background: model().hex, color: model().light ? "#000" : "#fff" }}
              title={model().clipped ? model().notice : model().canonical}
            />
          </Show>
          <Show when={model().parts.hexInput}>
            <input
              class={`${prefix()}__hex`}
              value={model().hex}
              spellcheck={false}
              aria-label="Hex colour"
              onInput={(e) => {
                const parsed = hexToOklch(e.currentTarget.value);
                if (parsed) dial(parsed);
              }}
            />
          </Show>
          <Show when={model().parts.name}>
            <span class={`${prefix()}__name`}>{model().name}</span>
          </Show>
        </div>
      </Show>

      <Show when={model().parts.notice && model().clipped}>
        <p class={`${prefix()}__notice`}>{model().notice}</p>
      </Show>
    </div>
  );
}

export type { LabelKey, PickerLayout, PickerParts } from "@oklch-picker/core";
export type { Axis, Gamut, Oklch } from "@oklch-picker/core";
