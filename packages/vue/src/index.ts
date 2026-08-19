/**
 * Vue adapter. A render function rather than an SFC, so no Vue compiler enters
 * the build — this is an ordinary TS module with `vue` external.
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
  chartPick,
  colourName,
  emitValue,
  gamutChartModel,
  hexToOklch,
  pickerModel,
  resolveCurrent,
  withSingleChart,
} from "@oklch-picker/core";
import { computed, defineComponent, h, ref } from "vue";
import type { PropType, VNode } from "vue";

/** One gamut chart: a 2D slice of the sRGB gamut, holding one axis fixed and
 * sweeping the other two, so under the curve is displayable and above it is
 * not. Split out so `computed` memoises each curve separately — dragging an
 * axis that does not feed a given curve reuses its ~65 stops. */
const GamutChart = defineComponent({
  name: "GamutChart",
  props: {
    /** The axis held fixed; the chart sweeps the other two. */
    axis: { type: String as PropType<Axis>, required: true },
    /** Memo key: the single input this curve depends on. */
    curveKey: { type: Number, required: true },
    /** 0..1 across the plot; drives the vertical crosshair. */
    x: { type: Number, required: true },
    /** 0..1 up the plot, bottom-up; drives the horizontal crosshair. */
    y: { type: Number, required: true },
    /** Called with 0..1 plot coordinates as the pointer moves. Omit for a
     * display-only chart. */
    onPick: { type: Function as PropType<(x: number, y: number) => void>, default: undefined },
    classPrefix: { type: String, required: true },
    resolution: { type: Number, default: 64 },
  },
  setup(props) {
    const curve = computed(() =>
      gamutChartModel(chartBase(props.curveKey, props.axis), props.axis, props.resolution),
    );

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
      const gradId = `${props.classPrefix}-gamut-${props.axis}`;
      const interactive = Boolean(props.onPick);
      const x = props.x * CHART_W;
      const y = CHART_H - Math.min(1, Math.max(0, props.y)) * CHART_H;
      const { path, stops } = curve.value;

      return h(
        "svg",
        {
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
    /** Visual arrangement. `chart` (the default) shows one large
     * lightness x chroma plot above all three sliders; `side-by-side` adds a right
     * rail for the readout and presets; `compact` drops the charts entirely and
     * inlines each label with its slider; `stacked` gives every axis its own
     * thin chart. */
    layout: { type: String as PropType<PickerLayout>, default: undefined },
    /** Turn parts off, e.g. `{ charts: false, name: false }`. All on by default. */
    parts: { type: Object as PropType<PickerParts>, default: undefined },
    /** Override for translation. */
    labels: {
      type: Object as PropType<Partial<Record<Axis | "outOfGamut", string>>>,
      default: undefined,
    },
    /** Class prefix for every element, so styles can be overridden. */
    classPrefix: { type: String, default: "oklch-picker" },
  },
  emits: {
    /** Canonical, gamut-clamped `oklch(L C H)`. */
    "update:modelValue": (colour: string) => typeof colour === "string",
    change: (colour: string) => typeof colour === "string",
  },
  setup(props, { emit }) {
    // What was dialled, not what was emitted: dragging through an out-of-gamut
    // region must not destroy the other axes.
    const draft = ref<Oklch | null>(null);
    const model = computed(() =>
      pickerModel(resolveCurrent(draft.value, props.modelValue), {
        layout: props.layout,
        parts: props.parts,
        labels: props.labels,
      }),
    );

    const publish = (colour: string) => {
      emit("update:modelValue", colour);
      emit("change", colour);
    };
    const dial = (next: Oklch) => {
      draft.value = next;
      publish(emitValue(next));
    };
    const pick = (colour: string) => {
      draft.value = null;
      publish(colour);
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

      if (single) {
        children.push(
          h(GamutChart, {
            axis: single.axis,
            curveKey: single.key,
            x: single.x,
            y: single.y,
            onPick: (x: number, y: number) => dial(chartPick(m.current, single.axis, x, y)),
            classPrefix: p,
          }),
        );
      }

      children.push(
        h(
          "div",
          { class: `${p}__axes` },
          m.axes.map((a, i) => {
            // In the `chart` layout the one chart is hoisted above the axes.
            const chart: ChartSlot | undefined = single ? undefined : m.charts[i];
            // A div, not a label — the slider has its own aria-label.
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
                    curveKey: chart.key,
                    x: chart.x,
                    y: chart.y,
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
                }),
              ]),
            ]);
          }),
        ),
      );

      if (m.withFooter) {
        const footer: VNode[] = [];
        if (m.parts.preview) {
          footer.push(
            h("span", {
              class: `${p}__preview`,
              style: { background: m.hex, color: m.light ? "#000" : "#fff" },
              title: m.clipped ? m.labels.outOfGamut : m.canonical,
            }),
          );
        }
        if (m.parts.hexInput) {
          footer.push(
            h("input", {
              class: `${p}__hex`,
              value: m.hex,
              spellcheck: "false",
              "aria-label": "Hex colour",
              onInput: (e: Event) => {
                const parsed = hexToOklch((e.target as HTMLInputElement).value);
                if (parsed) dial(parsed);
              },
            }),
          );
        }
        if (m.parts.name) footer.push(h("span", { class: `${p}__name` }, [m.name]));
        children.push(h("div", { class: `${p}__footer` }, footer));
      }

      if (m.parts.notice && m.clipped) {
        children.push(h("p", { class: `${p}__notice` }, [m.labels.outOfGamut]));
      }

      return h("div", { class: [p, `${p}--${m.layout}`] }, children);
    };
  },
});

export type { PickerLayout, PickerParts } from "@oklch-picker/core";
export type { Axis, Oklch } from "@oklch-picker/core";
