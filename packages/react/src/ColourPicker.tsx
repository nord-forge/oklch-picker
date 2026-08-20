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
  recentValue,
  resolveCurrent,
  toOklch,
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
  /** Recently used colours, most recent first. Omit to let the picker keep its
   * own list for the session; pass one to store them yourself, in a backend,
   * or shared between pickers. */
  recents?: string[];
  /** Called with the new list when a colour is committed, for the controlled
   * form above. Fires on commit, so on a pointer release, a preset, or a hex
   * entry. Not on every value a drag passes through. */
  onRecentsChange?: (recents: string[]) => void;
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

  // Recents are uncontrolled until `recents` is passed, mirroring how `value`
  // works. The internal list is kept regardless so switching to controlled
  // mid-session does not lose it.
  const [ownRecents, setOwnRecents] = useState<string[]>([]);
  const recents = props.recents ?? ownRecents;

  // A drag calls `onChange` for every value it passes through, so recording
  // there would bury the list in near-identical colours from one gesture.
  // Only a commit lands here. That is a pointer release, a preset or a hex
  // entry.
  const commit = (colour: string) => {
    const next = addRecent(recents, colour, props.maxRecents);
    setOwnRecents(next);
    props.onRecentsChange?.(next);
  };
  // Null while the dialled colour is outside the gamut, so a drag released in
  // a hatched region records nothing rather than the clamped near-miss.
  const commitCurrent = () => {
    const colour = recentValue(current, model.gamut);
    if (colour) commit(colour);
  };

  const emit = (next: Oklch) => {
    setDraft(next);
    props.onChange(emitValue(next, model.gamut));
  };
  const pick = (colour: string) => {
    setDraft(null);
    props.onChange(colour);
    commit(colour);
  };
  // Handlers are bound to both onInput and onChange. React fires the latter,
  // Preact the former. Each pair shares one function.
  //
  // `toOklch` rather than a per-field parser: a field accepts any supported
  // format whichever one it shows, so pasting a hex into the oklch field works
  // instead of being a rule to learn.
  const editColour = (e: { target: EventTarget | null }) => {
    const parsed = toOklch((e.target as HTMLInputElement).value);
    if (parsed) emit(parsed);
  };

  // Fully opaque drops the key rather than storing `a: 1`, so a colour dragged
  // to opaque emits `oklch(L C H)` and not `oklch(L C H / 1)`. One shape for
  // "opaque", set in one place.
  const slideAlpha = (e: { target: EventTarget | null }) => {
    const a = Number((e.target as HTMLInputElement).value);
    const { a: _drop, ...rest } = current;
    emit(a >= 1 ? rest : { ...rest, a });
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

      {show.recents && recents.length > 0 && (
        <div className={`${prefix}__recents`}>
          {recents.map((r) => (
            <button
              key={r}
              type="button"
              className={`${prefix}__recent${r === canonical ? ` ${prefix}__recent--selected` : ""}`}
              style={{ background: r }}
              onClick={() => pick(r)}
              aria-label={`Recent: ${colourName(r)}`}
              aria-pressed={r === canonical}
            />
          ))}
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
          gamut={model.gamut}
          scaleGamuts={model.scaleGamuts}
          onPick={(x, y) =>
            emit(chartPick(current, single.axis, x, y, model.gamut, model.scaleGamuts))
          }
          onPicked={commitCurrent}
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
          // A div, not a label. The slider has its own aria-label.
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
                  gamut={model.gamut}
                  scaleGamuts={model.scaleGamuts}
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
                  // The gesture ending is the commit, not each value it passed
                  // through. `blur` catches the keyboard: arrowing along a
                  // slider should record once the user moves on, not per step.
                  onPointerUp={commitCurrent}
                  onBlur={commitCurrent}
                />
              </span>
            </div>
          );
        })}

        {/* Alpha rides with the axes for layout but is not one of them. It has
            no gamut chart and no hatching, because transparency cannot put a
            colour outside what a screen can show. */}
        {model.withAlpha && (
          <div className={`${prefix}__axis ${prefix}__alpha`}>
            <span className={`${prefix}__axis-head`}>
              <span className={`${prefix}__axis-label`} aria-hidden="true">
                {layout === "compact" ? "A" : "Alpha"}
              </span>
              <output className={`${prefix}__axis-value`}>{model.alpha.value.toFixed(2)}</output>
            </span>

            <span className={`${prefix}__track`}>
              <span className={`${prefix}__track-fill`}>
                <span className={`${prefix}__alpha-check`} />
                <span
                  className={`${prefix}__alpha-ramp`}
                  style={{ background: model.alpha.track }}
                />
              </span>
              <input
                type="range"
                className={`${prefix}__slider`}
                min={model.alpha.min}
                max={model.alpha.max}
                step={model.alpha.step}
                value={model.alpha.value}
                aria-label="Alpha"
                onInput={slideAlpha}
                onChange={slideAlpha}
                onPointerUp={commitCurrent}
                onBlur={commitCurrent}
              />
            </span>
          </div>
        )}
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
          {/* Every field accepts any supported format, whichever it displays.
              Pasting a hex into the oklch field works, because refusing it
              would be a rule the reader has to learn for no benefit. */}
          {show.oklchInput && (
            <input
              className={`${prefix}__field ${prefix}__field--oklch`}
              value={model.oklch}
              spellCheck={false}
              aria-label="OKLCH colour"
              onInput={editColour}
              onChange={editColour}
              onBlur={commitCurrent}
            />
          )}
          {show.rgbInput && (
            <input
              className={`${prefix}__field ${prefix}__field--rgb`}
              value={model.rgb}
              spellCheck={false}
              aria-label="RGB colour"
              onInput={editColour}
              onChange={editColour}
              onBlur={commitCurrent}
            />
          )}
          {show.hexInput && (
            <input
              className={`${prefix}__field ${prefix}__field--hex ${prefix}__hex`}
              value={hex}
              spellCheck={false}
              aria-label="Hex colour"
              onInput={editColour}
              onChange={editColour}
              // Typing passes through half-entered colours, so the commit is
              // leaving the field rather than each keystroke.
              onBlur={commitCurrent}
            />
          )}
          {show.name && <span className={`${prefix}__name`}>{model.name}</span>}
        </div>
      )}

      {show.notice && clipped && <p className={`${prefix}__notice`}>{model.notice}</p>}
    </div>
  );
}
