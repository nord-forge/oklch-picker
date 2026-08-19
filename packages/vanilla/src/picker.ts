/**
 * `<oklch-picker>` — the picker as a custom element, on straight DOM calls.
 * No framework and no build step required, so this covers plain HTML, HTMX,
 * Alpine, Astro, and any server-rendered page (Rails, Laravel, Django, PHP).
 *
 * Light DOM, not shadow: the published stylesheet, `class-prefix` overrides,
 * and `light-dark()` theming all work exactly as they do in the framework
 * versions, at the cost of style isolation.
 */
import {
  type Axis,
  CHART_H,
  CHART_W,
  type ChartSlot,
  DEFAULT_LAYOUT,
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

const SVG_NS = "http://www.w3.org/2000/svg";

/** Set an attribute only when it changed — untouched DOM is not re-laid-out. */
function attr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  if (className) node.setAttribute("class", className);
  return node;
}

/** Parse a JSON attribute, ignoring malformed values rather than throwing —
 * an attribute typed by hand should never take the whole page down. */
function json<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** One axis row: the nodes are built once and mutated in place thereafter. */
interface AxisRow {
  root: HTMLElement;
  label: HTMLElement;
  output: HTMLOutputElement;
  chart?: ChartNodes;
  fill: HTMLElement;
  spans: HTMLElement[];
  slider: HTMLInputElement;
}

interface ChartNodes {
  root: SVGSVGElement;
  gradient: SVGLinearGradientElement;
  area: SVGPathElement;
  line: SVGPathElement;
  vertical: SVGLineElement;
  horizontal: SVGLineElement;
  /** Last curve key rendered, so the ~65 stops rebuild only when it changes. */
  key: number | null;
}

export class OklchPickerElement extends HTMLElement {
  static observedAttributes = ["value", "layout", "class-prefix", "parts", "labels", "presets"];

  /** Submit with a surrounding form, like any built-in input, so a
   * server-rendered page can round-trip the colour through a plain POST. */
  static formAssociated = true;

  /** Undefined where ElementInternals is missing; the element still works,
   * it just does not take part in form submission. */
  #internals: ElementInternals | undefined;
  #defaultValue: string | null | undefined;

  constructor() {
    super();
    // Guarded: older engines lack attachInternals, and the element should
    // still render there rather than throwing on construction.
    this.#internals = this.attachInternals?.();
  }

  /** What was dialled, not what was emitted: dragging through an out-of-gamut
   * region must not destroy the other axes. */
  #draft: Oklch | null = null;
  #value: string | null = null;
  #presets: string[] | null = null;
  #parts: PickerParts | undefined;
  #labels: Partial<Record<Axis | "outOfGamut", string>> | undefined;
  #prefix = "oklch-picker";
  #built = false;

  // Built once, then mutated. Rebuilding the tree per input would drop focus
  // from the slider mid-drag.
  #presetButtons: { button: HTMLButtonElement; colour: string }[] = [];
  #rows: AxisRow[] = [];
  /** The `chart` layout's single plot, above the axes rather than inside one. */
  #chart: ChartNodes | undefined;
  #preview: HTMLElement | undefined;
  #hex: HTMLInputElement | undefined;
  #name: HTMLElement | undefined;
  #notice: HTMLParagraphElement | undefined;

  /** `oklch(L C H)` or hex. Reading back gives what was last set. */
  get value(): string | null {
    return this.#value;
  }
  set value(next: string | null) {
    if (next === this.#value) return;
    this.#value = next;
    this.#draft = null;
    // Reflect so the DOM matches the property; the attribute callback bails
    // out on this write because #value already holds it.
    if (next === null) this.removeAttribute("value");
    else attr(this, "value", next);
    this.#internals?.setFormValue(next);
    this.#render();
  }

  /** The name this element submits under, mirroring a built-in input. */
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  set name(next: string) {
    this.setAttribute("name", next);
  }

  get form(): HTMLFormElement | null {
    return this.#internals?.form ?? null;
  }

  get presets(): string[] | null {
    return this.#presets;
  }
  set presets(next: string[] | null) {
    this.#presets = next;
    this.#rebuild();
  }

  get parts(): PickerParts | undefined {
    return this.#parts;
  }
  set parts(next: PickerParts | undefined) {
    this.#parts = next;
    this.#rebuild();
  }

  get labels(): Partial<Record<Axis | "outOfGamut", string>> | undefined {
    return this.#labels;
  }
  set labels(next: Partial<Record<Axis | "outOfGamut", string>> | undefined) {
    this.#labels = next;
    this.#render();
  }

  get layout(): PickerLayout {
    return (this.getAttribute("layout") as PickerLayout | null) ?? DEFAULT_LAYOUT;
  }
  set layout(next: PickerLayout) {
    this.setAttribute("layout", next);
  }

  get classPrefix(): string {
    return this.#prefix;
  }
  set classPrefix(next: string) {
    this.#prefix = next || "oklch-picker";
    this.#rebuild();
  }

  connectedCallback(): void {
    // Attributes are the source of truth on first upgrade; a property set
    // before upgrade is handled by #upgradeProperty below.
    for (const name of ["value", "presets", "parts", "labels", "classPrefix"] as const) {
      this.#upgradeProperty(name);
    }
    if (this.#value === null) this.#value = this.getAttribute("value");
    // What a form reset restores. Captured once, because #publish reflects
    // every change onto the `value` attribute as the user dials.
    this.#defaultValue ??= this.#value;
    this.#internals?.setFormValue(this.#value);
    this.#syncAttributes();
    this.#rebuild();
  }

  /** Form reset restores the server-rendered `value`, like a built-in input.
   * Assigning through the setter would be a no-op whenever the dialled colour
   * has already been reflected onto the attribute, so reset the state here. */
  formResetCallback(): void {
    this.#value = this.#defaultValue ?? null;
    this.#draft = null;
    if (this.#value === null) this.removeAttribute("value");
    else attr(this, "value", this.#value);
    this.#internals?.setFormValue(this.#value);
    this.#render();
  }

  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next) return;
    if (name === "value") {
      // Ignore the echo of our own emit; only outside writes reset the draft.
      if (next === this.#value) return;
      this.#value = next;
      this.#draft = null;
      this.#render();
      return;
    }
    this.#syncAttributes();
    this.#rebuild();
  }

  /** A property set before the element upgraded shadows the accessor; take
   * the value, delete it, and re-set it through the prototype. */
  #upgradeProperty(name: "value" | "presets" | "parts" | "labels" | "classPrefix"): void {
    if (!Object.hasOwn(this, name)) return;
    const held = (this as Record<string, unknown>)[name];
    delete (this as Record<string, unknown>)[name];
    (this as Record<string, unknown>)[name] = held;
  }

  #syncAttributes(): void {
    const prefix = this.getAttribute("class-prefix");
    if (prefix) this.#prefix = prefix;
    // Properties win over attributes: a JSON attribute is the no-framework
    // fallback, not an override of what script has already set.
    this.#parts ??= json<PickerParts>(this.getAttribute("parts"));
    this.#labels ??= json<Partial<Record<Axis | "outOfGamut", string>>>(
      this.getAttribute("labels"),
    );
    if (this.#presets === null) {
      const raw = this.getAttribute("presets");
      // Accept both a JSON array and a plain comma-separated list.
      this.#presets =
        json<string[]>(raw) ??
        (raw
          ? raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null);
    }
  }

  /** The colour showing right now. Handlers bound once at build time cannot
   * close over a model, so they read it back through here. */
  #currentColour(): Oklch {
    return resolveCurrent(this.#draft, this.#value);
  }

  /** Emit a dialled colour: keep it as the draft, publish the clamped form. */
  #emit(next: Oklch): void {
    this.#draft = next;
    this.#publish(emitValue(next));
  }

  /** Emit a chosen colour verbatim — a preset is already canonical. */
  #pick(colour: string): void {
    this.#draft = null;
    this.#publish(colour);
  }

  #publish(colour: string): void {
    this.#value = colour;
    // Reflect so the DOM shows the current value; guarded in the attribute
    // callback so this does not re-enter.
    attr(this, "value", colour);
    this.#internals?.setFormValue(colour);
    this.#render();
    this.dispatchEvent(
      new CustomEvent("change", { detail: { colour }, bubbles: true, composed: true }),
    );
  }

  /** The inner range and hex inputs fire their own bubbling `input`/`change`.
   * Those would reach a listener above the host looking indistinguishable from
   * ours but carrying no `detail`, so stop each one where it is raised. Bound
   * on the input itself rather than on the host: a listener here still runs
   * after any capture-phase listener further up the tree has already seen it. */
  #containBound = (event: Event) => event.stopPropagation();

  /** Keep an inner input's own events from escaping the element. */
  #contain(input: HTMLElement): void {
    input.addEventListener("input", this.#containBound);
    input.addEventListener("change", this.#containBound);
  }

  /** Structure changed (parts, prefix, presets): drop the tree and rebuild. */
  #rebuild(): void {
    if (!this.isConnected) return;
    this.replaceChildren();
    this.#presetButtons = [];
    this.#rows = [];
    this.#chart = undefined;
    this.#preview = undefined;
    this.#hex = undefined;
    this.#name = undefined;
    this.#notice = undefined;
    this.#built = false;
    this.#render();
  }

  #render(): void {
    if (!this.isConnected) return;
    const model = pickerModel(resolveCurrent(this.#draft, this.#value), {
      layout: this.layout,
      parts: this.#parts,
      labels: this.#labels,
    });
    if (!this.#built) this.#build(model);
    this.#update(model);
  }

  #build(model: ReturnType<typeof pickerModel>): void {
    const p = this.#prefix;
    this.className = `${p} ${p}--${model.layout}`;

    if (this.#presets && this.#presets.length > 0) {
      const row = el("div", `${p}__presets`);
      for (const colour of this.#presets) {
        const button = el("button", `${p}__preset`);
        button.type = "button";
        button.style.background = colour;
        button.setAttribute("aria-label", colourName(colour));
        button.addEventListener("click", () => this.#pick(colour));
        row.append(button);
        this.#presetButtons.push({ button, colour });
      }
      this.append(row);
    }

    // `chart` renders one plot for the whole picker rather than one per axis.
    // The layout is fixed until the attribute changes, and a change rebuilds,
    // so deciding here keeps #update to mutating attributes.
    const single = withSingleChart(model.layout) ? model.charts[0] : undefined;
    if (single) {
      this.#chart = this.#buildChart(single.axis, true);
      this.append(this.#chart.root);
    }

    const axes = el("div", `${p}__axes`);
    for (const [i, a] of model.axes.entries()) {
      const root = el("div", `${p}__axis`);
      const head = el("span", `${p}__axis-head`);
      const label = el("span", `${p}__axis-label`);
      label.setAttribute("aria-hidden", "true");
      const output = el("output", `${p}__axis-value`);
      head.append(label, output);
      root.append(head);

      // Read-only here: a 34px strip gives a drag almost no vertical travel,
      // and it would set two axes at once right above the slider that sets one
      // precisely. Only the `chart` layout's plot is big enough to drag.
      let chart: ChartNodes | undefined;
      if (!single && model.charts[i]) {
        chart = this.#buildChart(a.key, false);
        root.append(chart.root);
      }

      const track = el("span", `${p}__track`);
      const fill = el("span", `${p}__track-fill`);
      const slider = el("input", `${p}__slider`);
      slider.type = "range";
      // `input` alone: every browser with custom elements fires it for pointer
      // and keyboard alike, and also binding `change` would emit twice per
      // commit. The stray native `change` is contained in #contain.
      //
      // The colour is read at event time, not closed over: this listener is
      // bound once for the life of the node, so a build-time `model.current`
      // would reset every other axis to what it held when the picker was built.
      slider.addEventListener("input", () =>
        this.#emit({ ...this.#currentColour(), [a.key]: Number(slider.value) }),
      );
      this.#contain(slider);
      track.append(fill, slider);
      root.append(track);
      axes.append(root);

      this.#rows.push({
        root,
        label,
        output,
        ...(chart ? { chart } : {}),
        fill,
        spans: [],
        slider,
      });
    }
    this.append(axes);

    if (model.withFooter) {
      const footer = el("div", `${p}__footer`);
      if (model.parts.preview) {
        this.#preview = el("span", `${p}__preview`);
        footer.append(this.#preview);
      }
      if (model.parts.hexInput) {
        const hex = el("input", `${p}__hex`);
        hex.spellcheck = false;
        hex.setAttribute("aria-label", "Hex colour");
        hex.addEventListener("input", () => {
          const parsed = hexToOklch(hex.value);
          if (parsed) this.#emit(parsed);
        });
        this.#contain(hex);
        footer.append(hex);
        this.#hex = hex;
      }
      if (model.parts.name) {
        this.#name = el("span", `${p}__name`);
        footer.append(this.#name);
      }
      this.append(footer);
    }

    if (model.parts.notice) {
      this.#notice = el("p", `${p}__notice`);
      this.append(this.#notice);
    }

    this.#built = true;
  }

  #buildChart(axis: Axis, interactive: boolean): ChartNodes {
    const p = this.#prefix;
    const root = svg("svg", `${p}__chart${interactive ? ` ${p}__chart--interactive` : ""}`);
    root.setAttribute("viewBox", `0 0 ${CHART_W} ${CHART_H}`);
    root.setAttribute("preserveAspectRatio", "none");
    // The sliders stay the accessible path; dragging here is a shortcut.
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("focusable", "false");

    if (interactive) {
      // Pointer, not mouse, so a touch drag works. Pointer capture keeps the
      // drag alive once it leaves the chart, so the value still tracks rather
      // than sticking at the edge. These are our own events, not an inner
      // input's, so nothing needs containing — #emit dispatches once.
      const pick = (event: PointerEvent) => {
        const r = root.getBoundingClientRect();
        if (!r.width || !r.height) return;
        this.#emit(
          chartPick(
            this.#currentColour(),
            axis,
            (event.clientX - r.left) / r.width,
            (r.bottom - event.clientY) / r.height,
          ),
        );
      };
      root.addEventListener("pointerdown", (event) => {
        root.setPointerCapture(event.pointerId);
        pick(event);
      });
      root.addEventListener("pointermove", (event) => {
        if (root.hasPointerCapture(event.pointerId)) pick(event);
      });
    }

    const defs = svg("defs");
    const gradient = svg("linearGradient");
    // Gradient ids share a document-wide namespace, and a page may hold more
    // than one picker — qualify with the element's own id when it has one.
    gradient.setAttribute("id", `${p}-gamut-${this.id ? `${this.id}-` : ""}${axis}`);
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("x2", "1");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("y2", "0");
    defs.append(gradient);

    const area = svg("path");
    area.setAttribute("fill", `url(#${gradient.getAttribute("id")})`);
    const line = svg("path", `${p}__chart-line`);
    line.setAttribute("fill", "none");
    const vertical = svg("line", `${p}__crosshair`);
    vertical.setAttribute("y1", "0");
    vertical.setAttribute("y2", String(CHART_H));
    const horizontal = svg("line", `${p}__crosshair`);
    horizontal.setAttribute("x1", "0");
    horizontal.setAttribute("x2", String(CHART_W));

    root.append(defs, area, line, vertical, horizontal);
    return { root, gradient, area, line, vertical, horizontal, key: null };
  }

  #update(model: ReturnType<typeof pickerModel>): void {
    const p = this.#prefix;
    this.className = `${p} ${p}--${model.layout}`;

    for (const { button, colour } of this.#presetButtons) {
      const selected = colour === model.canonical;
      button.className = `${p}__preset${selected ? ` ${p}__preset--selected` : ""}`;
      button.setAttribute("aria-pressed", String(selected));
    }

    // The hoisted `chart` layout plot; the per-axis charts follow below.
    const single = model.charts[0];
    if (this.#chart && single) this.#updateChart(this.#chart, single);

    for (const [i, a] of model.axes.entries()) {
      const row = this.#rows[i];
      if (!row) continue;
      row.label.textContent =
        model.layout === "compact" ? a.key.toUpperCase() : model.labels[a.key];
      row.output.textContent = a.key === "h" ? String(Math.round(a.value)) : a.value.toFixed(2);

      const chart = model.charts[i];
      if (chart && row.chart) this.#updateChart(row.chart, chart);

      row.fill.style.background = model.gradients[i] ?? "";
      this.#updateSpans(row, model.spans[i] ?? []);

      // Writing a slider's own value mid-drag would fight the pointer, so only
      // write when it actually differs from what the element already shows.
      attr(row.slider, "min", String(a.min));
      attr(row.slider, "max", String(a.max));
      attr(row.slider, "step", String(a.step));
      attr(row.slider, "aria-label", model.labels[a.key]);
      if (Number(row.slider.value) !== a.value) row.slider.value = String(a.value);
    }

    if (this.#preview) {
      this.#preview.style.background = model.hex;
      this.#preview.style.color = model.light ? "#000" : "#fff";
      attr(this.#preview, "title", model.clipped ? model.labels.outOfGamut : model.canonical);
    }
    // Never overwrite what is being typed — a half-entered hex is not a colour.
    if (this.#hex && this.#hex !== this.ownerDocument.activeElement) this.#hex.value = model.hex;
    if (this.#name) this.#name.textContent = model.name;
    if (this.#notice) {
      this.#notice.textContent = model.clipped ? model.labels.outOfGamut : "";
      this.#notice.hidden = !model.clipped;
    }
  }

  #updateChart(nodes: ChartNodes, slot: ChartSlot): void {
    const axis = slot.axis;
    // The curve and its stops depend on one input; rebuild only when it moves.
    if (nodes.key !== slot.key) {
      const m = gamutChartModel(chartBase(slot.key, axis), axis);
      nodes.area.setAttribute("d", `M0,${CHART_H} L${m.path} L${CHART_W},${CHART_H} Z`);
      nodes.line.setAttribute("d", `M${m.path}`);
      nodes.gradient.replaceChildren(
        ...m.stops.map((s) => {
          const stop = svg("stop");
          stop.setAttribute("offset", `${s.offset}%`);
          stop.setAttribute("stop-color", s.hex);
          return stop;
        }),
      );
      nodes.key = slot.key;
    }
    const x = String(slot.x * CHART_W);
    attr(nodes.vertical, "x1", x);
    attr(nodes.vertical, "x2", x);
    const y = String(CHART_H - Math.min(1, Math.max(0, slot.y)) * CHART_H);
    attr(nodes.horizontal, "y1", y);
    attr(nodes.horizontal, "y2", y);
  }

  /** Hatched runs come and go as the colour moves, so this pools the nodes. */
  #updateSpans(row: AxisRow, spans: { start: number; end: number }[]): void {
    while (row.spans.length > spans.length) row.spans.pop()?.remove();
    while (row.spans.length < spans.length) {
      const span = el("span", `${this.#prefix}__out-of-gamut`);
      row.fill.append(span);
      row.spans.push(span);
    }
    for (const [i, s] of spans.entries()) {
      const node = row.spans[i];
      if (!node) continue;
      node.style.left = `${s.start * 100}%`;
      node.style.width = `${(s.end - s.start) * 100}%`;
    }
  }
}

/** Register the element. Explicit, so importing the class has no side effect —
 * `import "oklch-picker/vanilla/register"` does this for you. */
export function register(tag = "oklch-picker"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  customElements.define(tag, OklchPickerElement);
}

/** The `change` event the element emits. `detail.colour` is canonical and
 * gamut-clamped. */
export type OklchPickerChangeEvent = CustomEvent<{ colour: string }>;

declare global {
  interface HTMLElementTagNameMap {
    "oklch-picker": OklchPickerElement;
  }

  /** So `picker.addEventListener("change", e => e.detail.colour)` types. */
  interface OklchPickerElementEventMap extends HTMLElementEventMap {
    change: OklchPickerChangeEvent;
  }
}

/** Narrows `addEventListener` on the element so `change` carries the colour.
 * This merges with the class above — the standard way to type a custom
 * element's own events, and it adds no members that shadow the class. */
export interface OklchPickerElement {
  addEventListener<K extends keyof OklchPickerElementEventMap>(
    type: K,
    listener: (this: OklchPickerElement, event: OklchPickerElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof OklchPickerElementEventMap>(
    type: K,
    listener: (this: OklchPickerElement, event: OklchPickerElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
}
