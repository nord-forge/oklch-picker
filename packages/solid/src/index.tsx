/**
 * Solid adapter. Props are read lazily throughout — destructuring at the top
 * of a Solid component would snapshot them and break reactivity.
 */
import {
  type Axis,
  CHART_H,
  CHART_W,
  type ChartSlot,
  type Oklch,
  type PickerLayout,
  type PickerParts,
  chartBase,
  colourName,
  emitValue,
  gamutChartModel,
  hexToOklch,
  pickerModel,
  resolveCurrent,
} from "@oklch-picker/core";
import { For, Show, createMemo, createSignal } from "solid-js";

interface GamutChartProps {
  axis: Axis;
  /** Memo key: the single input this curve depends on. */
  curveKey: number;
  position: number;
  chromaFraction: number;
  classPrefix: string;
  resolution?: number;
}

/** One gamut chart. `createMemo` on the curve means dragging an axis that does
 * not feed it reuses the path and its ~65 gradient stops. */
function GamutChart(props: GamutChartProps) {
  const curve = createMemo(() =>
    gamutChartModel(chartBase(props.curveKey, props.axis), props.axis, props.resolution ?? 64),
  );
  const gradId = () => `${props.classPrefix}-gamut-${props.axis}`;
  const crossY = () => CHART_H - Math.min(1, Math.max(0, props.chromaFraction)) * CHART_H;

  return (
    <svg
      class={`${props.classPrefix}__chart`}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      // `focusable="false"` is omitted here, unlike the other adapters: it is a
      // legacy IE attribute Solid's JSX types do not model, and `aria-hidden`
      // already keeps the chart out of the accessibility tree.
      aria-hidden="true"
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

      <line
        x1={props.position * CHART_W}
        x2={props.position * CHART_W}
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
  /** Visual arrangement. `compact` drops the charts and inlines each label
   * with its slider; `side-by-side` puts the readout and presets in a right
   * rail. Default `stacked`. */
  layout?: PickerLayout;
  /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
  parts?: PickerParts;
  /** Override for translation. */
  labels?: Partial<Record<Axis | "outOfGamut", string>>;
  /** Class prefix for every element, so styles can be overridden. */
  classPrefix?: string;
  class?: string;
}

export function ColourPicker(props: ColourPickerProps) {
  const prefix = () => props.classPrefix ?? "oklch-picker";
  // What was dialled, not what was emitted: dragging through an out-of-gamut
  // region must not destroy the other axes.
  const [draft, setDraft] = createSignal<Oklch | null>(null);

  const model = createMemo(() =>
    pickerModel(resolveCurrent(draft(), props.value), {
      layout: props.layout,
      parts: props.parts,
      labels: props.labels,
    }),
  );

  const dial = (next: Oklch) => {
    setDraft(next);
    props.onChange(emitValue(next));
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

      <div class={`${prefix()}__axes`}>
        <For each={model().axes}>
          {(a, i) => {
            const chart = (): ChartSlot | undefined => model().charts[i()];
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

                <Show when={chart()}>
                  {(slot) => (
                    <GamutChart
                      axis={slot().axis}
                      curveKey={slot().key}
                      position={slot().position}
                      chromaFraction={slot().chromaFraction}
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

      <Show when={model().withFooter}>
        <div class={`${prefix()}__footer`}>
          <Show when={model().parts.preview}>
            <span
              class={`${prefix()}__preview`}
              style={{ background: model().hex, color: model().light ? "#000" : "#fff" }}
              title={model().clipped ? model().labels.outOfGamut : model().canonical}
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
        <p class={`${prefix()}__notice`}>{model().labels.outOfGamut}</p>
      </Show>
    </div>
  );
}

export type { PickerLayout, PickerParts } from "@oklch-picker/core";
export type { Axis, Oklch } from "@oklch-picker/core";
