/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import {
  type Gamut,
  type LabelKey,
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
import { useState } from "react";
import { GamutChart } from "./GamutChart.js";

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
  className?: string;
}

export function ColourPicker(props: ColourPickerProps) {
  const prefix = props.classPrefix ?? "oklch-picker";

  // What was dialled, not what was emitted: dragging through an out-of-gamut
  // region must not destroy the other axes.
  const [draft, setDraft] = useState<Oklch | null>(null);

  // The output space decides what `resolveCurrent` compares against, so it is
  // read from the prop here rather than from the model it feeds.
  const current = resolveCurrent(draft, props.value, props.gamut);
  const model = pickerModel(current, {
    layout: props.layout,
    parts: props.parts,
    labels: props.labels,
    gamut: props.gamut,
    references: props.references,
    gamutChoices: props.gamutChoices,
  });
  const { labels, layout, hex, canonical, clipped } = model;
  const show = model.parts;
  // `chart` renders one plot for the whole picker rather than one per axis.
  const single = withSingleChart(layout) ? model.charts[0] : undefined;

  const emit = (next: Oklch) => {
    setDraft(next);
    props.onChange(emitValue(next, model.gamut));
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

      {single && (
        <GamutChart
          base={current}
          axis={single.axis}
          id={single.axis}
          x={single.x}
          y={single.y}
          references={model.references}
          onPick={(x, y) => emit(chartPick(current, single.axis, x, y))}
          classPrefix={prefix}
        />
      )}

      <div className={`${prefix}__axes`}>
        {model.axes.map((a, i) => {
          const spans = model.spans[i] ?? [];
          // In the `chart` layout the one chart is hoisted above the axes.
          const chart = single ? undefined : model.charts[i];
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

              {/* Read-only here: a 34px strip gives a drag almost no vertical
                  travel, and it would set two axes at once right above the
                  slider that sets one precisely. Only `chart` is big enough. */}
              {chart && (
                <GamutChart
                  base={current}
                  axis={a.key}
                  id={a.key}
                  x={chart.x}
                  y={chart.y}
                  references={model.references}
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

      {model.withGamutSwitch && (
        /* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form
           controls and brings a legend and its own box; this is a toolbar of
           buttons, which is what role="group" describes. */
        <div className={`${prefix}__gamut-switch`} role="group" aria-label="Output gamut">
          {model.gamutChoices.map((g) => {
            const selected = g.id === model.gamut.id;
            return (
              <button
                key={g.id}
                type="button"
                className={`${prefix}__gamut-choice`}
                aria-pressed={selected}
                aria-label={`Output in ${g.label}`}
                onClick={() => props.onGamutChange?.(g)}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      {model.withFooter && (
        <div className={`${prefix}__footer`}>
          {show.preview && (
            <span
              className={`${prefix}__preview`}
              style={{ background: hex, color: model.light ? "#000" : "#fff" }}
              title={clipped ? model.notice : canonical}
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

      {show.notice && clipped && <p className={`${prefix}__notice`}>{model.notice}</p>}
    </div>
  );
}
