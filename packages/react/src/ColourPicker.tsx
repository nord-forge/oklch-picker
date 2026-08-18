/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import {
  type Axis,
  type Oklch,
  type PickerLayout,
  type PickerParts,
  colourName,
  emitValue,
  hexToOklch,
  pickerModel,
  resolveCurrent,
} from "@oklch-picker/core";
import { useState } from "react";
import { GamutChart } from "./GamutChart.js";

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
  className?: string;
}

export function ColourPicker(props: ColourPickerProps) {
  const prefix = props.classPrefix ?? "oklch-picker";

  // What was dialled, not what was emitted: dragging through an out-of-gamut
  // region must not destroy the other axes.
  const [draft, setDraft] = useState<Oklch | null>(null);

  const current = resolveCurrent(draft, props.value);
  const model = pickerModel(current, {
    layout: props.layout,
    parts: props.parts,
    labels: props.labels,
  });
  const { labels, layout, hex, canonical, clipped, withCharts } = model;
  const show = model.parts;

  const emit = (next: Oklch) => {
    setDraft(next);
    props.onChange(emitValue(next));
  };
  const pick = (colour: string) => {
    setDraft(null);
    props.onChange(colour);
  };
  // Handlers are bound to both onInput and onChange — React fires the latter,
  // Preact the former. Each pair shares one function.
  const editHex = (e: { target: EventTarget | null }) => {
    const parsed = hexToOklch((e.target as HTMLInputElement).value);
    if (parsed) emit(parsed);
  };

  return (
    <div className={[prefix, `${prefix}--${layout}`, props.className].filter(Boolean).join(" ")}>
      {props.presets && props.presets.length > 0 && (
        <div className={`${prefix}__presets`}>
          {props.presets.map((p) => {
            const selected = p === canonical;
            return (
              <button
                key={p}
                type="button"
                className={`${prefix}__preset${selected ? ` ${prefix}__preset--selected` : ""}`}
                style={{ background: p }}
                onClick={() => pick(p)}
                aria-label={colourName(p)}
                aria-pressed={selected}
              />
            );
          })}
        </div>
      )}

      <div className={`${prefix}__axes`}>
        {model.axes.map((a, i) => {
          const spans = model.spans[i] ?? [];
          const chart = model.charts[i];
          const slide = (e: { target: EventTarget | null }) =>
            emit({ ...current, [a.key]: Number((e.target as HTMLInputElement).value) });
          // A div, not a label — the slider has its own aria-label.
          return (
            <div key={a.key} className={`${prefix}__axis`}>
              <span className={`${prefix}__axis-head`}>
                <span className={`${prefix}__axis-label`} aria-hidden="true">
                  {layout === "compact" ? a.key.toUpperCase() : labels[a.key]}
                </span>
                <output className={`${prefix}__axis-value`}>
                  {a.key === "h" ? Math.round(a.value) : a.value.toFixed(2)}
                </output>
              </span>

              {chart && (
                <GamutChart
                  base={current}
                  axis={a.key}
                  id={a.key}
                  position={chart.position}
                  chromaFraction={chart.chromaFraction}
                  classPrefix={prefix}
                />
              )}

              <span className={`${prefix}__track`}>
                <span
                  className={`${prefix}__track-fill`}
                  style={{ background: model.gradients[i] }}
                >
                  {spans.map((s) => (
                    <span
                      key={`${a.key}-${s.start}`}
                      className={`${prefix}__out-of-gamut`}
                      style={{ left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%` }}
                    />
                  ))}
                </span>
                <input
                  type="range"
                  className={`${prefix}__slider`}
                  min={a.min}
                  max={a.max}
                  step={a.step}
                  value={a.value}
                  aria-label={labels[a.key]}
                  onInput={slide}
                  onChange={slide}
                />
              </span>
            </div>
          );
        })}
      </div>

      {model.withFooter && (
        <div className={`${prefix}__footer`}>
          {show.preview && (
            <span
              className={`${prefix}__preview`}
              style={{ background: hex, color: model.light ? "#000" : "#fff" }}
              title={clipped ? labels.outOfGamut : canonical}
            />
          )}
          {show.hexInput && (
            <input
              className={`${prefix}__hex`}
              value={hex}
              spellCheck={false}
              aria-label="Hex colour"
              onInput={editHex}
              onChange={editHex}
            />
          )}
          {show.name && <span className={`${prefix}__name`}>{model.name}</span>}
        </div>
      )}

      {show.notice && clipped && <p className={`${prefix}__notice`}>{labels.outOfGamut}</p>}
    </div>
  );
}
