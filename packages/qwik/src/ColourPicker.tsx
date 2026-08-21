/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import { $, type QRL, component$, useComputed$, useId, useStore } from "@builder.io/qwik";
import type { Axis, LabelKey, Oklch, PickerLayout, PickerParts } from "@oklch-picker/core";
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
import { GamutChart } from "./GamutChart.js";
import { type GamutId, gamutFrom, gamutsFrom, idOf } from "./gamuts.js";

export interface ColourPickerProps {
  /** `oklch(L C H)` or hex. */
  value?: string | null | undefined;
  /** A canonical, gamut-clamped `oklch(L C H)` string. */
  onChange$?: QRL<(colour: string) => void>;
  presets?: string[] | undefined;
  /** Recently used colours, most recent first. Omit to let the picker keep its
   * own list for the session; pass one to store them yourself. */
  recents?: string[] | undefined;
  /** The new list when a colour is committed. Fires on commit, so on a pointer
   * release, a preset, or a text entry. Not on every value a drag passes
   * through. */
  onRecentsChange$?: QRL<(recents: string[]) => void>;
  /** How many recents to keep. Ignored when `recents` is controlled. */
  maxRecents?: number | undefined;
  /** Visual arrangement. `chart` (the default) shows one large
   * lightness x chroma plot above all three sliders. */
  layout?: PickerLayout | undefined;
  /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
  parts?: PickerParts | undefined;
  /** Override for translation. */
  labels?: Partial<Record<LabelKey, string>> | undefined;
  /** The output space, by id: what the sliders reach, what is clamped, and what
   * is emitted. An id rather than a `Gamut` object, because Qwik serialises
   * props and a `Gamut` carries a function. See `gamuts.ts`. */
  gamut?: GamutId | undefined;
  /** Spaces to outline on the charts without clamping to them. */
  references?: GamutId[] | undefined;
  /** What the switcher offers, when `parts.gamutSwitch` is on. */
  gamutChoices?: GamutId[] | undefined;
  /** A switcher button was pressed, carrying the new gamut's id. */
  onGamutChange$?: QRL<(gamut: GamutId) => void>;
  /** Class prefix for every element, so styles can be overridden. */
  classPrefix?: string | undefined;
  class?: string | undefined;
}

export const ColourPicker = component$<ColourPickerProps>((props) => {
  const prefix = props.classPrefix ?? "oklch-picker";
  // `useId` rather than a module counter. The optimizer splits each `$()` into
  // its own chunk, and a counter there becomes an imported binding that cannot
  // be incremented: "Illegal reassignment of import". Only a production build
  // surfaces that, so the example app is what caught it. `useId` is also stable
  // across the server render and the resumption that follows.
  const uid = useId();

  /** What was dialled, not what was emitted: dragging through an out-of-gamut
   * region must not destroy the other axes.
   *
   * A store rather than a signal, because Qwik serialises the draft to resume
   * the component and a plain object round-trips where a class would not. */
  const draft = useStore<{ current: Oklch | null }>({ current: null });

  /** Recents are uncontrolled until `recents` is passed, mirroring how `value`
   * works. The internal list is kept regardless so switching to controlled
   * mid-session does not lose it. */
  const ownRecents = useStore<{ list: string[] }>({ list: [] });

  const recents = useComputed$(() => props.recents ?? ownRecents.list);

  /** The output space decides what `resolveCurrent` compares against, so it is
   * read from the prop here rather than from the model it feeds. */
  const current = useComputed$(() =>
    resolveCurrent(draft.current, props.value, gamutFrom(props.gamut)),
  );

  /** The scale gamuts as ids, computed rather than mapped inline.
   *
   * Mapping in the JSX builds a new array on every render. Qwik sees a changed
   * prop each time, and the re-render that follows drops the whole component's
   * event bindings: the first slider move works and every one after it is
   * silently ignored. A computed keeps the reference stable.
   *
   * Ids rather than the gamuts themselves, for the same serialisation reason
   * as the props. */
  /** The references the model derived, as ids. sRGB is outlined whenever the
   * output space is wider, so passing the raw prop through drew nothing. */
  const referenceIds = useComputed$(() =>
    pickerModel(current.value, {
      layout: props.layout,
      parts: props.parts,
      gamut: gamutFrom(props.gamut),
      references: gamutsFrom(props.references),
      gamutChoices: gamutsFrom(props.gamutChoices),
    }).references.map(idOf),
  );

  const scaleIds = useComputed$(() =>
    pickerModel(current.value, {
      layout: props.layout,
      parts: props.parts,
      gamut: gamutFrom(props.gamut),
      references: gamutsFrom(props.references),
      gamutChoices: gamutsFrom(props.gamutChoices),
    }).scaleGamuts.map(idOf),
  );

  const emit = $(async (next: Oklch) => {
    draft.current = next;
    await props.onChange$?.(emitValue(next, gamutFrom(props.gamut)));
  });

  /** A drag calls `onChange$` for every value it passes through, so recording
   * there would bury the list in near-identical colours from one gesture. Only
   * a commit lands here. */
  const commit = $(async (colour: string) => {
    const next = addRecent(props.recents ?? ownRecents.list, colour, props.maxRecents);
    ownRecents.list = next;
    await props.onRecentsChange$?.(next);
  });

  /** Null while the dialled colour is outside the gamut, so a drag released in
   * a hatched region records nothing rather than the clamped near-miss. */
  const commitCurrent = $(async () => {
    const colour = recentValue(current.value, gamutFrom(props.gamut));
    if (colour) await commit(colour);
  });

  const pick = $(async (colour: string) => {
    draft.current = null;
    await props.onChange$?.(colour);
    await commit(colour);
  });

  /** `toOklch` rather than a per-field parser: a field accepts any supported
   * format whichever one it shows, so pasting a hex into the oklch field works
   * instead of being a rule to learn. */
  const editColour = $(async (raw: string) => {
    const parsed = toOklch(raw);
    if (parsed) await emit(parsed);
  });

  /** Derived during render rather than held in a `useComputed$`.
   *
   * A `PickerModel` carries the resolved `gamut` and `scaleGamuts`, and those
   * carry `fromLms`. Qwik serialises what a computed signal holds, so keeping
   * the model in one fails the server render with "Only primitive and object
   * literals can be serialized". Recomputing per render is what the other
   * adapters do anyway: `pickerModel` is pure and cheap, and the expensive part
   * is the chart curve, which `GamutChart` memoises on its own. */
  const m = pickerModel(current.value, {
    layout: props.layout,
    parts: props.parts,
    labels: props.labels,
    gamut: gamutFrom(props.gamut),
    references: gamutsFrom(props.references),
    gamutChoices: gamutsFrom(props.gamutChoices),
  });
  /** `chart` renders one plot for the whole picker rather than one per axis. */
  const single = withSingleChart(m.layout) ? m.charts[0] : undefined;
  // Pulled out as a plain string so the pick handler captures that rather than
  // the whole slot object.
  const axis = single?.axis ?? "l";

  return (
    <div class={[prefix, `${prefix}--${m.layout}`, props.class].filter(Boolean).join(" ")}>
      {props.presets && props.presets.length > 0 && (
        <div class={`${prefix}__presets`}>
          {props.presets.map((p) => (
            <button
              key={p}
              type="button"
              class={
                p === m.canonical
                  ? `${prefix}__preset ${prefix}__preset--selected`
                  : `${prefix}__preset`
              }
              style={{ background: p }}
              aria-label={colourName(p)}
              aria-pressed={p === m.canonical}
              onClick$={() => pick(p)}
            />
          ))}
        </div>
      )}

      {m.parts.recents && recents.value.length > 0 && (
        <div class={`${prefix}__recents`}>
          {recents.value.map((r) => (
            <button
              key={r}
              type="button"
              class={
                r === m.canonical
                  ? `${prefix}__recent ${prefix}__recent--selected`
                  : `${prefix}__recent`
              }
              style={{ background: r }}
              aria-label={`Recent: ${colourName(r)}`}
              aria-pressed={r === m.canonical}
              onClick$={() => pick(r)}
            />
          ))}
        </div>
      )}

      {single && (
        <GamutChart
          base={current.value}
          axis={axis}
          id={`${uid}-${single.axis}`}
          x={single.x}
          y={single.y}
          references={referenceIds.value}
          gamut={props.gamut}
          scaleGamuts={scaleIds.value}
          classPrefix={prefix}
          onPick$={$(async (x: number, y: number) => {
            // Everything a handler needs is resolved inside it, from ids. The
            // optimizer serialises whatever a QRL closes over, so capturing
            // `m.scaleGamuts` would put `fromLms` in the serialised scope and
            // fail the server render.
            await emit(
              chartPick(
                current.value,
                axis,
                x,
                y,
                gamutFrom(props.gamut),
                scaleIds.value.map(gamutFrom),
              ),
            );
          })}
          onPicked$={commitCurrent}
        />
      )}

      <div class={`${prefix}__axes`}>
        {m.axes.map((a, i) => {
          const spans = m.spans[i] ?? [];
          // In the `chart` layout the one chart is hoisted above the axes.
          const chart = single ? undefined : m.charts[i];
          return (
            <div key={a.key} class={`${prefix}__axis`}>
              <span class={`${prefix}__axis-head`}>
                <span class={`${prefix}__axis-label`} aria-hidden="true">
                  {m.layout === "compact" ? a.key.toUpperCase() : m.labels[a.key]}
                </span>
                <output class={`${prefix}__axis-value`}>
                  {a.key === "h" ? Math.round(a.value) : a.value.toFixed(2)}
                </output>
              </span>

              {/* Read-only here: a 34px strip gives a drag almost no vertical
                  travel, and it would set two axes at once right above the
                  slider that sets one precisely. Only `chart` is big enough. */}
              {chart && (
                <GamutChart
                  base={current.value}
                  axis={a.key}
                  id={`${uid}-${a.key}`}
                  x={chart.x}
                  y={chart.y}
                  references={referenceIds.value}
                  gamut={props.gamut}
                  scaleGamuts={scaleIds.value}
                  classPrefix={prefix}
                />
              )}

              <span class={`${prefix}__track`}>
                <span class={`${prefix}__track-fill`} style={{ background: m.gradients[i] }}>
                  {spans.map((s) => (
                    <span
                      key={`${a.key}-${s.start}`}
                      class={`${prefix}__out-of-gamut`}
                      style={{ left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%` }}
                    />
                  ))}
                </span>
                <input
                  type="range"
                  class={`${prefix}__slider`}
                  min={a.min}
                  max={a.max}
                  step={a.step}
                  value={a.value}
                  aria-label={m.labels[a.key]}
                  aria-valuetext={a.valuetext}
                  onInput$={(_, el) => emit({ ...current.value, [a.key]: Number(el.value) })}
                  // The gesture ending is the commit, not each value it passed
                  // through. `blur` catches the keyboard: arrowing along a
                  // slider should record once the user moves on, not per step.
                  onPointerUp$={commitCurrent}
                  onBlur$={commitCurrent}
                />
              </span>
            </div>
          );
        })}

        {/* Alpha rides with the axes for layout but is not one of them. It has
            no gamut chart and no hatching, because transparency cannot put a
            colour outside what a screen can show. */}
        {m.withAlpha && (
          <div class={`${prefix}__axis ${prefix}__alpha`}>
            <span class={`${prefix}__axis-head`}>
              <span class={`${prefix}__axis-label`} aria-hidden="true">
                {m.layout === "compact" ? "A" : "Alpha"}
              </span>
              <output class={`${prefix}__axis-value`}>{m.alpha.value.toFixed(2)}</output>
            </span>

            <span class={`${prefix}__track`}>
              <span class={`${prefix}__track-fill`}>
                <span class={`${prefix}__alpha-check`} />
                <span class={`${prefix}__alpha-ramp`} style={{ background: m.alpha.track }} />
              </span>
              <input
                type="range"
                class={`${prefix}__slider`}
                min={m.alpha.min}
                max={m.alpha.max}
                step={m.alpha.step}
                value={m.alpha.value}
                aria-label="Alpha"
                aria-valuetext={m.alpha.valuetext}
                onInput$={(_, el) => {
                  // Fully opaque drops the key rather than storing `a: 1`, so a
                  // colour dragged to opaque emits `oklch(L C H)` and not
                  // `oklch(L C H / 1)`. One shape for "opaque", set in one place.
                  const a = Number(el.value);
                  const { a: _drop, ...rest } = current.value;
                  return emit(a >= 1 ? rest : { ...rest, a });
                }}
                onPointerUp$={commitCurrent}
                onBlur$={commitCurrent}
              />
            </span>
          </div>
        )}
      </div>

      {m.withGamutSwitch && (
        /* biome-ignore lint/a11y/useSemanticElements: a <fieldset> is for form
           controls and brings a legend and its own box; this is a toolbar of
           buttons, which is what role="group" describes. */
        <div class={`${prefix}__gamut-switch`} role="group" aria-label="Output gamut">
          {m.gamutChoices.map((g) => {
            // The id and label as plain strings before the handler exists. A
            // QRL serialises whatever it closes over, and `g` carries
            // `fromLms`, so capturing it drops this whole subtree silently:
            // the model says to render a switcher and no buttons appear.
            const id = idOf(g);
            const label = g.label;
            return (
              <button
                key={id}
                type="button"
                class={`${prefix}__gamut-choice`}
                aria-pressed={id === m.gamut.id}
                aria-label={`Output in ${label}`}
                onClick$={() => props.onGamutChange$?.(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {m.withFooter && (
        <div class={`${prefix}__footer`}>
          {m.parts.preview && (
            <span
              class={`${prefix}__preview`}
              style={{ background: m.hex, color: m.light ? "#000" : "#fff" }}
              title={m.clipped ? m.notice : m.canonical}
            />
          )}
          {/* Every field accepts any supported format, whichever it displays.
              Pasting a hex into the oklch field works, because refusing it
              would be a rule the reader has to learn for no benefit. */}
          {m.parts.oklchInput && (
            <input
              class={`${prefix}__field ${prefix}__field--oklch`}
              value={m.oklch}
              spellcheck={false}
              aria-label="OKLCH colour"
              onInput$={(_, el) => editColour(el.value)}
              onBlur$={commitCurrent}
            />
          )}
          {m.parts.rgbInput && (
            <input
              class={`${prefix}__field ${prefix}__field--rgb`}
              value={m.rgb}
              spellcheck={false}
              aria-label="RGB colour"
              onInput$={(_, el) => editColour(el.value)}
              onBlur$={commitCurrent}
            />
          )}
          {m.parts.hexInput && (
            <input
              class={`${prefix}__field ${prefix}__field--hex ${prefix}__hex`}
              value={m.hex}
              spellcheck={false}
              aria-label="Hex colour"
              onInput$={(_, el) => editColour(el.value)}
              // Typing passes through half-entered colours, so the commit is
              // leaving the field rather than each keystroke.
              onBlur$={commitCurrent}
            />
          )}
          {m.parts.name && <span class={`${prefix}__name`}>{m.name}</span>}
        </div>
      )}

      {/* Always rendered, empty until something is clipped: a live region only
          announces if it was in the DOM before the text arrived. */}
      {m.parts.notice && (
        /* biome-ignore lint/a11y/useSemanticElements: <output> is a form control's
           calculated result, and this file already uses it for the axis
           readouts. This is an advisory about the colour, so role="status" on a
           paragraph is the honest mapping. */
        <p class={`${prefix}__notice`} role="status">
          {m.clipped ? m.notice : ""}
        </p>
      )}
    </div>
  );
});
