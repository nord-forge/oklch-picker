/**
 * Vue adapter. A render function rather than an SFC, so no Vue compiler enters
 * the build. This is an ordinary TS module with `vue` external.
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
  labelTransform,
  pickerModel,
  recentValue,
  resolveCurrent,
  toOklch,
  withSingleChart,
} from "@oklch-picker/core";
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, useId } from "vue";
import type { PropType, VNode } from "vue";

/** One gamut chart: a 2D slice of the sRGB gamut, holding one axis fixed and
 * sweeping the other two, so under the curve is displayable and above it is
 * not. Split out so `computed` memoises each curve separately. Dragging an
 * axis that does not feed a given curve reuses its ~65 stops. */
const GamutChart = defineComponent({
  name: "GamutChart",
  props: {
    /** The axis held fixed; the chart sweeps the other two. */
    axis: { type: String as PropType<Axis>, required: true },
    /** Unique per picker instance. SVG gradient ids share a document-wide
     * namespace, so the axis alone is not enough to tell two pickers apart. */
    uid: { type: String, required: true },
    /** Memo key: the single input this curve depends on. */
    curveKey: { type: Number, required: true },
    /** 0..1 across the plot; drives the vertical crosshair. */
    x: { type: Number, required: true },
    /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
    y: { type: Number, required: true },
    /** Called with 0..1 plot coordinates as the pointer moves. Omit for a
     * display-only chart. */
    onPick: { type: Function as PropType<(x: number, y: number) => void>, default: undefined },
    /** Called when a drag ends, so the caller can record the settled colour
     * rather than every value the gesture passed through. */
    onPicked: { type: Function as PropType<() => void>, default: undefined },
    /** Reference spaces to outline over the filled region. Omit for none. */
    references: { type: Array as PropType<Gamut[] | undefined>, default: undefined },
    /** The output space. The filled region is this gamut's reach, so a P3 picker
     * plots P3 rather than sRGB with an outline drawn over it. */
    gamut: { type: Object as PropType<Gamut | undefined>, default: undefined },
    /** Every space in view, drawn or not, which sets the vertical scale. */
    scaleGamuts: { type: Array as PropType<Gamut[] | undefined>, default: undefined },
    classPrefix: { type: String, required: true },
    resolution: { type: Number, default: 64 },
  },
  setup(props) {
    // The boundaries ride along in this memo rather than taking their own: they
    // come from the same sweep, so a second computed would walk the axis twice.
    const curve = computed(() =>
      gamutChartModel(
        chartBase(props.curveKey, props.axis),
        props.axis,
        props.resolution,
        props.references,
        props.gamut,
        props.scaleGamuts,
      ),
    );

    // The chart's rendered pixel size, for the labels' counter-scale. Measured
    // rather than assumed: the chart is fluid, so the ratio moves with it.
    const root = ref<SVGSVGElement | null>(null);
    const size = ref({ w: 0, h: 0 });
    let observer: ResizeObserver | undefined;
    onMounted(() => {
      const node = root.value;
      if (!node) return;
      observer = new ResizeObserver(([entry]) => {
        const r = entry?.contentRect;
        if (r) size.value = { w: r.width, h: r.height };
      });
      observer.observe(node);
    });
    onBeforeUnmount(() => observer?.disconnect());

    // Pointer capture keeps a drag alive once it leaves the chart, so the value
    // still tracks rather than sticking at the edge.
    const pick = (e: PointerEvent) => {
      const onPick = props.onPick;
      if (!onPick) return;
      const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      if (!r.width || !r.height) return;
      onPick((e.clientX - r.left) / r.width, (r.bottom - e.clientY) / r.height);
    };

    return () => {
      const gradId = `${props.classPrefix}-gamut-${props.uid}-${props.axis}`;
      const interactive = Boolean(props.onPick);
      const x = props.x * CHART_W;
      const y = CHART_H - Math.min(1, Math.max(0, props.y)) * CHART_H;
      const { path, stops, boundaries } = curve.value;

      return h(
        "svg",
        {
          ref: root,
          class: `${props.classPrefix}__chart${interactive ? ` ${props.classPrefix}__chart--interactive` : ""}`,
          viewBox: `0 0 ${CHART_W} ${CHART_H}`,
          preserveAspectRatio: "none",
          "aria-hidden": "true",
          focusable: "false",
          onPointerdown: interactive
            ? (e: PointerEvent) => {
                (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
                pick(e);
              }
            : undefined,
          onPointermove: interactive
            ? (e: PointerEvent) => {
                if ((e.currentTarget as SVGSVGElement).hasPointerCapture(e.pointerId)) pick(e);
              }
            : undefined,
          // The release is the commit; the drag itself is a continuous preview.
          onPointerup: interactive ? () => props.onPicked?.() : undefined,
        },
        [
          h("defs", [
            h(
              "linearGradient",
              { id: gradId, x1: "0", x2: "1", y1: "0", y2: "0" },
              stops.map((s) =>
                h("stop", { key: s.offset, offset: `${s.offset}%`, "stop-color": s.hex }),
              ),
            ),
          ]),
          h("path", {
            d: `M0,${CHART_H} L${path} L${CHART_W},${CHART_H} Z`,
            fill: `url(#${gradId})`,
          }),
          h("path", { d: `M${path}`, fill: "none", class: `${props.classPrefix}__chart-line` }),
          // Named on the line: a dashed outline with no label leaves the
          // reader guessing which space it marks.
          //
          // The viewBox is stretched non-uniformly, so text placed straight
          // into it is huge and squashed. `labelTransform` undoes the scale so
          // the glyphs land at the size the stylesheet asks for. It is null
          // until the chart has been measured, and no label beats a wrong one
          // for a frame.
          ...boundaries.flatMap((b) => {
            const transform = labelTransform(b.labelX, b.labelY, size.value.w, size.value.h);
            const nodes: VNode[] = [
              h("path", {
                key: b.id,
                d: `M${b.path}`,
                fill: "none",
                class: `${props.classPrefix}__gamut-boundary ${props.classPrefix}__gamut-boundary--${b.id}`,
              }),
            ];
            if (transform) {
              nodes.push(
                h("g", { key: `${b.id}-label`, transform }, [
                  h(
                    "text",
                    {
                      class: `${props.classPrefix}__gamut-label`,
                      "text-anchor": "middle",
                      y: "-5",
                    },
                    [b.label],
                  ),
                ]),
              );
            }
            return nodes;
          }),
          h("line", { x1: x, x2: x, y1: 0, y2: CHART_H, class: `${props.classPrefix}__crosshair` }),
          h("line", { x1: 0, x2: CHART_W, y1: y, y2: y, class: `${props.classPrefix}__crosshair` }),
        ],
      );
    };
  },
});

export const ColourPicker = defineComponent({
  name: "ColourPicker",
  props: {
    /** `oklch(L C H)` or hex. Named for `v-model`. */
    modelValue: { type: String as PropType<string | null>, default: null },
    presets: { type: Array as PropType<string[]>, default: undefined },
    /** Recently used colours, most recent first. Omit to let the picker keep
     * its own list for the session; pass one to store them yourself, in a
     * backend, or shared between pickers. */
    recents: { type: Array as PropType<string[]>, default: undefined },
    /** How many recents to keep. Ignored when `recents` is controlled: the
     * list you pass is the list that renders. */
    maxRecents: { type: Number, default: undefined },
    /** Visual arrangement. `chart` (the default) shows one large
     * lightness x chroma plot above all three sliders; `side-by-side` adds a right
     * rail for the readout and presets; `compact` drops the charts entirely and
     * inlines each label with its slider; `stacked` gives every axis its own
     * thin chart. */
    layout: { type: String as PropType<PickerLayout>, default: undefined },
    /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
    parts: { type: Object as PropType<PickerParts>, default: undefined },
    /** Override for translation. Keys are the three axes, `outOfGamut`, and
     * `outOf:<gamut id>` for a wider space's own notice. */
    labels: {
      type: Object as PropType<Partial<Record<LabelKey, string>>>,
      default: undefined,
    },
    /** The output space: what the sliders reach, what is clamped, and what is
     * emitted. Defaults to sRGB. Import wider spaces from
     * `@oklch-picker/core/gamuts`; omitting this ships none of that code. */
    gamut: { type: Object as PropType<Gamut>, default: undefined },
    /** Spaces to outline on the charts without clamping to them. Defaults to
     * sRGB whenever `gamut` is wider, so the safe region stays visible. */
    references: { type: Array as PropType<Gamut[]>, default: undefined },
    /** What the switcher offers, when `parts.gamutSwitch` is on. Defaults to
     * the output gamut plus its references. */
    gamutChoices: { type: Array as PropType<Gamut[]>, default: undefined },
    /** Class prefix for every element, so styles can be overridden. */
    classPrefix: { type: String, default: "oklch-picker" },
  },
  emits: {
    /** Canonical, gamut-clamped `oklch(L C H)`. */
    "update:modelValue": (colour: string) => typeof colour === "string",
    change: (colour: string) => typeof colour === "string",
    /** A switcher button was pressed. The app owns `gamut`, so it decides
     * whether to act on this. */
    gamutChange: (gamut: Gamut) => typeof gamut === "object",
    /** The new recents list, for the controlled form. Fires on commit, so on
     * a pointer release, a preset, or a hex entry. Not on every value a drag
     * passes through. */
    recentsChange: (recents: string[]) => Array.isArray(recents),
  },
  setup(props, { emit }) {
    // SVG ids share one document-wide namespace, so two pickers on a page both
    // emitting `oklch-picker-gamut-h` made the second chart fill from the first
    // one's gradient. `useId` is stable across server and client, so this fixes
    // the collision without breaking hydration.
    const uid = useId() ?? "";

    // What was dialled, not what was emitted: dragging through an out-of-gamut
    // region must not destroy the other axes.
    const draft = ref<Oklch | null>(null);
    // The output space decides what `resolveCurrent` compares against, so it is
    // read from the prop here rather than from the model it feeds.
    const model = computed(() =>
      pickerModel(resolveCurrent(draft.value, props.modelValue, props.gamut), {
        layout: props.layout,
        parts: props.parts,
        labels: props.labels,
        gamut: props.gamut,
        references: props.references,
        gamutChoices: props.gamutChoices,
      }),
    );

    const publish = (colour: string) => {
      emit("update:modelValue", colour);
      emit("change", colour);
    };
    const dial = (next: Oklch) => {
      draft.value = next;
      publish(emitValue(next, model.value.gamut));
    };
    // Recents are uncontrolled until `recents` is passed, mirroring how
    // `modelValue` works. The internal list is kept regardless so switching to
    // controlled mid-session does not lose it.
    const ownRecents = ref<string[]>([]);
    const recents = computed(() => props.recents ?? ownRecents.value);

    // A drag emits for every value it passes through, so recording there would
    // bury the list in near-identical colours from one gesture. Only a commit
    // lands here. That is a pointer release, a preset or a hex entry.
    const commit = (colour: string) => {
      const next = addRecent(recents.value, colour, props.maxRecents);
      ownRecents.value = next;
      emit("recentsChange", next);
    };
    // Null while the dialled colour is outside the gamut, so a drag released
    // in a hatched region records nothing rather than the clamped near-miss.
    const commitCurrent = () => {
      const colour = recentValue(model.value.current, model.value.gamut);
      if (colour) commit(colour);
    };

    const pick = (colour: string) => {
      draft.value = null;
      publish(colour);
      commit(colour);
    };

    return () => {
      const p = props.classPrefix;
      const m = model.value;
      const children: VNode[] = [];
      // `chart` renders one plot for the whole picker rather than one per axis.
      const single: ChartSlot | undefined = withSingleChart(m.layout) ? m.charts[0] : undefined;

      if (props.presets && props.presets.length > 0) {
        children.push(
          h(
            "div",
            { class: `${p}__presets` },
            props.presets.map((colour) => {
              const selected = colour === m.canonical;
              return h("button", {
                key: colour,
                type: "button",
                class: `${p}__preset${selected ? ` ${p}__preset--selected` : ""}`,
                style: { background: colour },
                "aria-label": colourName(colour),
                "aria-pressed": selected,
                onClick: () => pick(colour),
              });
            }),
          ),
        );
      }

      if (m.parts.recents && recents.value.length > 0) {
        children.push(
          h(
            "div",
            { class: `${p}__recents` },
            recents.value.map((colour) => {
              const selected = colour === m.canonical;
              return h("button", {
                key: colour,
                type: "button",
                class: `${p}__recent${selected ? ` ${p}__recent--selected` : ""}`,
                style: { background: colour },
                "aria-label": `Recent: ${colourName(colour)}`,
                "aria-pressed": selected,
                onClick: () => pick(colour),
              });
            }),
          ),
        );
      }

      if (single) {
        children.push(
          h(GamutChart, {
            axis: single.axis,
            uid,
            curveKey: single.key,
            x: single.x,
            y: single.y,
            references: m.references,
            gamut: m.gamut,
            scaleGamuts: m.scaleGamuts,
            onPick: (x: number, y: number) =>
              dial(chartPick(m.current, single.axis, x, y, m.gamut, m.scaleGamuts)),
            onPicked: commitCurrent,
            classPrefix: p,
          }),
        );
      }

      const axisRows: VNode[] = m.axes.map((a, i) => {
        // In the `chart` layout the one chart is hoisted above the axes.
        const chart: ChartSlot | undefined = single ? undefined : m.charts[i];
        // A div, not a label. The slider has its own aria-label.
        return h("div", { key: a.key, class: `${p}__axis` }, [
          h("span", { class: `${p}__axis-head` }, [
            h("span", { class: `${p}__axis-label`, "aria-hidden": "true" }, [
              m.layout === "compact" ? a.key.toUpperCase() : m.labels[a.key],
            ]),
            h("output", { class: `${p}__axis-value` }, [
              a.key === "h" ? String(Math.round(a.value)) : a.value.toFixed(2),
            ]),
          ]),

          // Read-only here: a 34px strip gives a drag almost no vertical
          // travel, and it would set two axes at once right above the
          // slider that sets one precisely. Only `chart` is big enough.
          chart
            ? h(GamutChart, {
                axis: chart.axis,
                uid,
                curveKey: chart.key,
                x: chart.x,
                y: chart.y,
                references: m.references,
                gamut: m.gamut,
                scaleGamuts: m.scaleGamuts,
                classPrefix: p,
              })
            : null,

          h("span", { class: `${p}__track` }, [
            h(
              "span",
              { class: `${p}__track-fill`, style: { background: m.gradients[i] } },
              (m.spans[i] ?? []).map((s) =>
                h("span", {
                  key: `${a.key}-${s.start}`,
                  class: `${p}__out-of-gamut`,
                  style: { left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%` },
                }),
              ),
            ),
            h("input", {
              type: "range",
              class: `${p}__slider`,
              min: a.min,
              max: a.max,
              step: a.step,
              value: a.value,
              "aria-label": m.labels[a.key],
              onInput: (e: Event) =>
                dial({ ...m.current, [a.key]: Number((e.target as HTMLInputElement).value) }),
              // The gesture ending is the commit, not each value it passed
              // through. `blur` catches the keyboard: arrowing along a
              // slider should record once the user moves on, not per step.
              onPointerup: commitCurrent,
              onBlur: commitCurrent,
            }),
          ]),
        ]);
      });

      // Alpha rides with the axes for layout but is not one of them. No chart
      // and no hatching: transparency cannot put a colour out of gamut.
      if (m.withAlpha) {
        axisRows.push(
          h("div", { key: "alpha", class: `${p}__axis ${p}__alpha` }, [
            h("span", { class: `${p}__axis-head` }, [
              h("span", { class: `${p}__axis-label`, "aria-hidden": "true" }, [
                m.layout === "compact" ? "A" : "Alpha",
              ]),
              h("output", { class: `${p}__axis-value` }, [m.alpha.value.toFixed(2)]),
            ]),
            h("span", { class: `${p}__track` }, [
              h("span", { class: `${p}__track-fill` }, [
                h("span", { class: `${p}__alpha-check` }),
                h("span", { class: `${p}__alpha-ramp`, style: { background: m.alpha.track } }),
              ]),
              h("input", {
                type: "range",
                class: `${p}__slider`,
                min: m.alpha.min,
                max: m.alpha.max,
                step: m.alpha.step,
                value: m.alpha.value,
                "aria-label": "Alpha",
                onInput: (e: Event) => {
                  const a = Number((e.target as HTMLInputElement).value);
                  // Opaque drops the key rather than storing `a: 1`, so one
                  // shape means opaque everywhere.
                  const { a: _drop, ...rest } = m.current;
                  dial(a >= 1 ? rest : { ...rest, a });
                },
                onPointerup: commitCurrent,
                onBlur: commitCurrent,
              }),
            ]),
          ]),
        );
      }

      children.push(h("div", { class: `${p}__axes` }, axisRows));

      if (m.withGamutSwitch) {
        children.push(
          h(
            "div",
            { class: `${p}__gamut-switch`, role: "group", "aria-label": "Output gamut" },
            m.gamutChoices.map((g) =>
              h(
                "button",
                {
                  key: g.id,
                  type: "button",
                  class: `${p}__gamut-choice`,
                  "aria-pressed": g.id === m.gamut.id,
                  "aria-label": `Output in ${g.label}`,
                  onClick: () => emit("gamutChange", g),
                },
                [g.label],
              ),
            ),
          ),
        );
      }

      if (m.withFooter) {
        const footer: VNode[] = [];
        if (m.parts.preview) {
          footer.push(
            h("span", {
              class: `${p}__preview`,
              style: { background: m.hex, color: m.light ? "#000" : "#fff" },
              title: m.clipped ? m.notice : m.canonical,
            }),
          );
        }
        // One builder for all three fields. Each accepts any supported format
        // whichever one it shows, so `toOklch` parses rather than a per-field
        // parser: pasting a hex into the oklch field should work.
        const field = (kind: "oklch" | "rgb" | "hex", label: string, value: string) =>
          h("input", {
            class: [`${p}__field`, `${p}__field--${kind}`, kind === "hex" ? `${p}__hex` : null],
            value,
            spellcheck: "false",
            "aria-label": label,
            onInput: (e: Event) => {
              const parsed = toOklch((e.target as HTMLInputElement).value);
              if (parsed) dial(parsed);
            },
            // Typing passes through half-entered colours, so the commit is
            // leaving the field rather than each keystroke.
            onBlur: commitCurrent,
          });

        if (m.parts.oklchInput) footer.push(field("oklch", "OKLCH colour", m.oklch));
        if (m.parts.rgbInput) footer.push(field("rgb", "RGB colour", m.rgb));
        if (m.parts.hexInput) footer.push(field("hex", "Hex colour", m.hex));
        if (m.parts.name) footer.push(h("span", { class: `${p}__name` }, [m.name]));
        children.push(h("div", { class: `${p}__footer` }, footer));
      }

      if (m.parts.notice && m.clipped) {
        children.push(h("p", { class: `${p}__notice` }, [m.notice]));
      }

      return h("div", { class: [p, `${p}--${m.layout}`] }, children);
    };
  },
});

export type { LabelKey, PickerLayout, PickerParts } from "@oklch-picker/core";
export type { Axis, Gamut, Oklch } from "@oklch-picker/core";
