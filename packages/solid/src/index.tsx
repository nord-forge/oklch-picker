/**
 * Solid adapter. Props are read lazily throughout. Destructuring at the top
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
  addRecent,
  chartBase,
  chartPick,
  colourName,
  emitValue,
  gamutChartModel,
  gamutsKey,
  labelTransform,
  pickerModel,
  recentValue,
  resolveCurrent,
  toOklch,
  withSingleChart,
} from "@oklch-picker/core";
import {
  For,
  Index,
  Show,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";

interface GamutChartProps {
  /** The axis held fixed; the chart sweeps the other two. */
  axis: Axis;
  /** Unique per picker instance. SVG gradient ids share a document-wide
   * namespace, so the axis alone is not enough to tell two pickers apart. */
  uid: string;
  /** Memo key: the single input this curve depends on. */
  curveKey: number;
  /** 0..1 across the plot; drives the vertical crosshair. */
  x: number;
  /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
  y: number;
  /** Called with 0..1 plot coordinates as the pointer moves. Omit for a
   * display-only chart. */
  onPick?: (x: number, y: number) => void;
  /** Called when a drag ends, so the caller can record the settled colour
   * rather than every value the gesture passed through. */
  onPicked?: () => void;
  /** Reference spaces to outline over the filled region. Omit for none. */
  references?: Gamut[] | undefined;
  /** The output space. The filled region is this gamut's reach, so a P3 picker
   * plots P3 rather than sRGB with an outline drawn over it. */
  gamut?: Gamut | undefined;
  /** Every space in view, drawn or not, which sets the vertical scale. */
  scaleGamuts?: Gamut[] | undefined;
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
  // Keyed on the gamuts' ids rather than the arrays. `pickerModel` hands back a
  // stable instance now, but a memo that reads the array still re-runs whenever
  // the parent's model object is replaced, which is every render. Depending on
  // a string means the curve is rebuilt only when the spaces really differ.
  const curveInputs = createMemo(
    () => ({
      base: chartBase(props.curveKey, props.axis),
      axis: props.axis,
      resolution: props.resolution ?? 64,
      key: `${gamutsKey(props.references ?? [])}|${props.gamut?.id ?? ""}|${gamutsKey(
        props.scaleGamuts ?? [],
      )}`,
    }),
    undefined,
    {
      equals: (a, b) =>
        a.key === b.key &&
        a.axis === b.axis &&
        a.resolution === b.resolution &&
        a.base[a.axis] === b.base[b.axis],
    },
  );
  const curve = createMemo(() => {
    const i = curveInputs();
    // Untracked: the ids are already in `curveInputs`, so reading the arrays
    // here as well would re-subscribe to the identity this is avoiding.
    return untrack(() =>
      gamutChartModel(
        i.base,
        i.axis,
        i.resolution,
        props.references,
        props.gamut,
        props.scaleGamuts,
      ),
    );
  });
  const gradId = () => `${props.classPrefix}-gamut-${props.uid}-${props.axis}`;
  const crossY = () => CHART_H - Math.min(1, Math.max(0, props.y)) * CHART_H;

  // The chart's rendered pixel size, for the labels' counter-scale. Measured
  // rather than assumed: the chart is fluid, so the ratio moves with it.
  let root: SVGSVGElement | undefined;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    observer.observe(root);
    onCleanup(() => observer.disconnect());
  });

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
      ref={root}
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
      // The release is the commit; the drag itself is a continuous preview.
      onPointerUp={() => props.onPick && props.onPicked?.()}
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
          <>
            <path
              d={`M${b.path}`}
              fill="none"
              class={`${props.classPrefix}__gamut-boundary ${props.classPrefix}__gamut-boundary--${b.id}`}
            />
            {/* Named on the line: a dashed outline with no label leaves the
                reader guessing which space it marks.

                The viewBox is stretched non-uniformly, so text placed straight
                into it is huge and squashed. `labelTransform` undoes the scale
                so the glyphs land at the size the stylesheet asks for. It is
                null until the chart has been measured, and no label beats a
                wrong one for a frame. */}
            <Show when={labelTransform(b.labelX, b.labelY, size().w, size().h)}>
              {(transform) => (
                <g transform={transform()}>
                  <text class={`${props.classPrefix}__gamut-label`} text-anchor="middle" y="-5">
                    {b.label}
                  </text>
                </g>
              )}
            </Show>
          </>
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
  class?: string;
}

export function ColourPicker(props: ColourPickerProps) {
  const prefix = () => props.classPrefix ?? "oklch-picker";
  // SVG ids share one document-wide namespace, so two pickers on a page both
  // emitting `oklch-picker-gamut-h` made the second chart fill from the first
  // one's gradient. `createUniqueId` is stable across server and client, so
  // this fixes the collision without breaking hydration.
  const uid = createUniqueId();

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

  // Recents are uncontrolled until `recents` is passed, mirroring how `value`
  // works. The internal list is kept regardless so switching to controlled
  // mid-session does not lose it.
  const [ownRecents, setOwnRecents] = createSignal<string[]>([]);
  const recents = () => props.recents ?? ownRecents();

  // A drag calls `onChange` for every value it passes through, so recording
  // there would bury the list in near-identical colours from one gesture.
  // Only a commit lands here. That is a pointer release, a preset or a hex
  // entry.
  const commit = (colour: string) => {
    const next = addRecent(recents(), colour, props.maxRecents);
    setOwnRecents(next);
    props.onRecentsChange?.(next);
  };
  // Null while the dialled colour is outside the gamut, so a drag released in
  // a hatched region records nothing rather than the clamped near-miss.
  const commitCurrent = () => {
    const colour = recentValue(model().current, model().gamut);
    if (colour) commit(colour);
  };

  const pick = (colour: string) => {
    setDraft(null);
    props.onChange(colour);
    commit(colour);
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

      <Show when={model().parts.recents && recents().length > 0}>
        <div class={`${prefix()}__recents`}>
          <For each={recents()}>
            {(colour) => {
              const selected = () => colour === model().canonical;
              return (
                <button
                  type="button"
                  class={`${prefix()}__recent${selected() ? ` ${prefix()}__recent--selected` : ""}`}
                  style={{ background: colour }}
                  aria-label={`Recent: ${colourName(colour)}`}
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
            uid={uid}
            curveKey={slot().key}
            x={slot().x}
            y={slot().y}
            references={model().references}
            gamut={model().gamut}
            scaleGamuts={model().scaleGamuts}
            onPick={(x, y) =>
              dial(
                chartPick(model().current, slot().axis, x, y, model().gamut, model().scaleGamuts),
              )
            }
            onPicked={commitCurrent}
            classPrefix={prefix()}
          />
        )}
      </Show>

      <div class={`${prefix()}__axes`}>
        {/* `Index`, not `For`: `For` keys by object identity, and `axisModels`
            returns fresh objects each render, so every keystroke replaced all
            three rows, taking focus and pointer capture with them mid-drag.
            The axes are a fixed three in a fixed order, so position is the
            right key. */}
        <Index each={model().axes}>
          {(a, i) => {
            // In the `chart` layout the one chart is hoisted above the axes.
            const chart = (): ChartSlot | undefined => (single() ? undefined : model().charts[i]);
            // A div, not a label. The slider has its own aria-label.
            return (
              <div class={`${prefix()}__axis`}>
                <span class={`${prefix()}__axis-head`}>
                  <span class={`${prefix()}__axis-label`} aria-hidden="true">
                    {model().layout === "compact" ? a().key.toUpperCase() : model().labels[a().key]}
                  </span>
                  <output class={`${prefix()}__axis-value`}>
                    {a().key === "h" ? Math.round(a().value) : a().value.toFixed(2)}
                  </output>
                </span>

                {/* Read-only here: a 34px strip gives a drag almost no vertical
                    travel, and it would set two axes at once right above the
                    slider that sets one precisely. Only `chart` is big enough. */}
                <Show when={chart()}>
                  {(slot) => (
                    <GamutChart
                      axis={slot().axis}
                      uid={uid}
                      curveKey={slot().key}
                      x={slot().x}
                      y={slot().y}
                      references={model().references}
                      gamut={model().gamut}
                      scaleGamuts={model().scaleGamuts}
                      classPrefix={prefix()}
                    />
                  )}
                </Show>

                <span class={`${prefix()}__track`}>
                  <span
                    class={`${prefix()}__track-fill`}
                    style={{ background: model().gradients[i] }}
                  >
                    <For each={model().spans[i]}>
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
                    min={a().min}
                    max={a().max}
                    step={a().step}
                    value={a().value}
                    aria-label={model().labels[a().key]}
                    onInput={(e) =>
                      dial({ ...model().current, [a().key]: Number(e.currentTarget.value) })
                    }
                    // The gesture ending is the commit, not each value it
                    // passed through. `blur` catches the keyboard: arrowing
                    // along a slider should record once the user moves on,
                    // not per step.
                    onPointerUp={commitCurrent}
                    onBlur={commitCurrent}
                  />
                </span>
              </div>
            );
          }}
        </Index>

        {/* Alpha rides with the axes for layout but is not one of them. No
            chart and no hatching, because transparency cannot put a colour
            outside what a screen can show. */}
        <Show when={model().withAlpha}>
          <div class={`${prefix()}__axis ${prefix()}__alpha`}>
            <span class={`${prefix()}__axis-head`}>
              <span class={`${prefix()}__axis-label`} aria-hidden="true">
                {model().layout === "compact" ? "A" : "Alpha"}
              </span>
              <output class={`${prefix()}__axis-value`}>{model().alpha.value.toFixed(2)}</output>
            </span>

            <span class={`${prefix()}__track`}>
              <span class={`${prefix()}__track-fill`}>
                <span class={`${prefix()}__alpha-check`} />
                <span
                  class={`${prefix()}__alpha-ramp`}
                  style={{ background: model().alpha.track }}
                />
              </span>
              <input
                type="range"
                class={`${prefix()}__slider`}
                min={model().alpha.min}
                max={model().alpha.max}
                step={model().alpha.step}
                value={model().alpha.value}
                aria-label="Alpha"
                onInput={(e) => {
                  const a = Number(e.currentTarget.value);
                  // Opaque drops the key rather than storing `a: 1`, so one
                  // shape means opaque everywhere.
                  const { a: _drop, ...rest } = model().current;
                  dial(a >= 1 ? rest : { ...rest, a });
                }}
                onPointerUp={commitCurrent}
                onBlur={commitCurrent}
              />
            </span>
          </div>
        </Show>
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
          {/* Every field accepts any supported format whichever one it shows,
              so `toOklch` parses rather than a per-field parser. Pasting a hex
              into the oklch field works instead of being a rule to learn.
              Typing passes through half-entered colours, so the commit is
              leaving the field rather than each keystroke. */}
          <Show when={model().parts.oklchInput}>
            <input
              class={`${prefix()}__field ${prefix()}__field--oklch`}
              value={model().oklch}
              spellcheck={false}
              aria-label="OKLCH colour"
              onInput={(e) => {
                const parsed = toOklch(e.currentTarget.value);
                if (parsed) dial(parsed);
              }}
              onBlur={commitCurrent}
            />
          </Show>
          <Show when={model().parts.rgbInput}>
            <input
              class={`${prefix()}__field ${prefix()}__field--rgb`}
              value={model().rgb}
              spellcheck={false}
              aria-label="RGB colour"
              onInput={(e) => {
                const parsed = toOklch(e.currentTarget.value);
                if (parsed) dial(parsed);
              }}
              onBlur={commitCurrent}
            />
          </Show>
          <Show when={model().parts.hexInput}>
            <input
              class={`${prefix()}__field ${prefix()}__field--hex ${prefix()}__hex`}
              value={model().hex}
              spellcheck={false}
              aria-label="Hex colour"
              onInput={(e) => {
                const parsed = toOklch(e.currentTarget.value);
                if (parsed) dial(parsed);
              }}
              onBlur={commitCurrent}
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
