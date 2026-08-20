/**
 * `<oklch-picker>`, the picker as a custom element, on straight DOM calls.
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
  type Gamut,
  type LabelKey,
  type Oklch,
  type PickerLayout,
  type PickerParts,
  SRGB,
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

const SVG_NS = "http://www.w3.org/2000/svg";

/** Set an attribute only when it changed. Untouched DOM is not re-laid-out. */
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

/** Parse a JSON attribute, ignoring malformed values rather than throwing.
 * An attribute typed by hand should never take the whole page down. */
function json<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** A list-of-colours attribute, as either a JSON array or a plain
 * comma-separated list. Hand-written markup should not have to quote. */
function colourList(raw: string | null): string[] | null {
  return (
    json<string[]>(raw) ??
    (raw
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null)
  );
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
  /** One outline per reference space, aligned with the model's `references`.
   * Built once and mutated, like every other node here; a change to the gamut
   * configuration rebuilds. */
  boundaries: SVGPathElement[];
  /** The wrapper each label sits in, aligned by the same index. The counter-
   * scale that keeps the glyphs readable goes on the group, so the text keeps
   * its own untransformed coordinates. */
  labelGroups: SVGGElement[];
  vertical: SVGLineElement;
  horizontal: SVGLineElement;
  /** Last curve key rendered, so the ~65 stops rebuild only when it changes. */
  key: number | null;
  /** The chart's rendered pixel size, written by the resize observer. The
   * labels' counter-scale needs it, and it cannot be assumed: the chart is
   * fluid, so the ratio moves with it. */
  width: number;
  height: number;
  /** The boundary anchors from the last curve, in viewBox units. Kept so a
   * resize can re-place the labels without recomputing the sweep. */
  anchors: { x: number; y: number }[];
}

export class OklchPickerElement extends HTMLElement {
  static observedAttributes = [
    "value",
    "layout",
    "class-prefix",
    "parts",
    "labels",
    "presets",
    "recents",
  ];

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
  /** The controlled list, or null while the element keeps its own. */
  #recents: string[] | null = null;
  /** Kept regardless of `recents`, so handing control over mid-session does
   * not lose what the user has already picked. */
  #ownRecents: string[] = [];
  #maxRecents: number | undefined;
  #parts: PickerParts | undefined;
  #labels: Partial<Record<LabelKey, string>> | undefined;
  #gamut: Gamut | undefined;
  #references: Gamut[] | undefined;
  #gamutChoices: Gamut[] | undefined;
  #prefix = "oklch-picker";
  #built = false;
  /** The reference spaces the current tree was built for, so #updateChart can
   * write a `d` per index without re-deriving them. */
  #builtReferences: Gamut[] = [];
  /** Every space in view, drawn or not. Held separately from the drawn ones so
   * a wider space still sets the chart's scale without adding a line. */
  #builtScaleGamuts: Gamut[] = [];

  // Built once, then mutated. Rebuilding the tree per input would drop focus
  // from the slider mid-drag.
  #presetButtons: { button: HTMLButtonElement; colour: string }[] = [];
  /** The recents row and the buttons in it. Unlike every other row here the
   * list grows, so #updateRecents rebuilds these children. Only these,
   * because rebuilding the tree would drop focus from the slider mid-drag. */
  #recentsRow: HTMLElement | undefined;
  #recentButtons: { button: HTMLButtonElement; colour: string }[] = [];
  #rows: AxisRow[] = [];
  /** The `chart` layout's single plot, above the axes rather than inside one. */
  #chart: ChartNodes | undefined;
  /** Every chart in the tree, hoisted plot and per-axis strips alike, so one
   * observer can serve them all and a rebuild can drop them together. */
  #charts: ChartNodes[] = [];
  /** Created with the first chart, disconnected when the element leaves the
   * document. Charts are fluid, and the labels' counter-scale needs the
   * rendered pixel size rather than an assumed one. */
  #resize: ResizeObserver | undefined;
  #gamutButtons: { button: HTMLButtonElement; gamut: Gamut }[] = [];
  /** The alpha row's mutable parts. Built once like every other row. */
  #alphaRow: { output: HTMLOutputElement; ramp: HTMLElement; slider: HTMLInputElement } | undefined;
  #preview: HTMLElement | undefined;
  #oklchField: HTMLInputElement | undefined;
  #rgbField: HTMLInputElement | undefined;
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

  /** Recently committed colours, most recent first. Null is the default. It
   * leaves the element keeping its own list for the session; assigning one
   * makes it controlled, exactly as `value` is. */
  get recents(): string[] | null {
    return this.#recents;
  }
  set recents(next: string[] | null) {
    this.#recents = next;
    // Only the row's children change, so this is a render rather than a
    // rebuild. The sliders keep their nodes and their focus.
    this.#render();
  }

  /** How many recents to keep. Ignored while `recents` is controlled: the list
   * assigned is the list that renders. */
  get maxRecents(): number | undefined {
    return this.#maxRecents;
  }
  set maxRecents(next: number | undefined) {
    this.#maxRecents = next;
    this.#render();
  }

  get parts(): PickerParts | undefined {
    return this.#parts;
  }
  set parts(next: PickerParts | undefined) {
    this.#parts = next;
    this.#rebuild();
  }

  get labels(): Partial<Record<LabelKey, string>> | undefined {
    return this.#labels;
  }
  set labels(next: Partial<Record<LabelKey, string>> | undefined) {
    this.#labels = next;
    this.#render();
  }

  /** The output space: what the sliders reach, what is clamped, and what is
   * emitted. A property, not an attribute: a `Gamut` carries a conversion
   * function, which no attribute string could express. Import wider spaces
   * from `@oklch-picker/core/gamuts`.
   *
   * Rebuilds rather than re-renders. Each reference space owns a path node,
   * and those are built once and mutated thereafter. */
  get gamut(): Gamut | undefined {
    return this.#gamut;
  }
  set gamut(next: Gamut | undefined) {
    this.#gamut = next;
    this.#rebuild();
  }

  /** Spaces outlined on the charts but never clamped to. Property-only, for
   * the same reason as `gamut`. */
  get references(): Gamut[] | undefined {
    return this.#references;
  }
  set references(next: Gamut[] | undefined) {
    this.#references = next;
    this.#rebuild();
  }

  /** What the switcher offers, when `parts.gamutSwitch` is on. Property-only,
   * for the same reason as `gamut`. */
  get gamutChoices(): Gamut[] | undefined {
    return this.#gamutChoices;
  }
  set gamutChoices(next: Gamut[] | undefined) {
    this.#gamutChoices = next;
    this.#rebuild();
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
    for (const name of [
      "value",
      "presets",
      "recents",
      "maxRecents",
      "parts",
      "labels",
      "gamut",
      "references",
      "gamutChoices",
      "classPrefix",
    ] as const) {
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

  /** Leaving the document should not leave an observer watching detached
   * nodes. Reconnecting runs connectedCallback, which rebuilds the tree and
   * observes the fresh charts, so nothing is lost by dropping it here. */
  disconnectedCallback(): void {
    this.#resize?.disconnect();
    this.#resize = undefined;
    this.#charts = [];
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
  #upgradeProperty(
    name:
      | "value"
      | "presets"
      | "recents"
      | "maxRecents"
      | "parts"
      | "labels"
      | "gamut"
      | "references"
      | "gamutChoices"
      | "classPrefix",
  ): void {
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
    this.#labels ??= json<Partial<Record<LabelKey, string>>>(this.getAttribute("labels"));
    if (this.#presets === null) this.#presets = colourList(this.getAttribute("presets"));
    // An attribute makes the list controlled just as the property does: markup
    // that names the recents is markup that owns them.
    if (this.#recents === null) this.#recents = colourList(this.getAttribute("recents"));
  }

  /** The colour showing right now. Handlers bound once at build time cannot
   * close over a model, so they read it back through here. */
  #currentColour(): Oklch {
    return resolveCurrent(this.#draft, this.#value, this.#gamut);
  }

  /** Emit a dialled colour: keep it as the draft, publish the clamped form.
   * Clamped to the output gamut, not to sRGB. Otherwise a P3 picker would
   * throw away the chroma it was configured to reach. */
  #emit(next: Oklch): void {
    this.#draft = next;
    this.#publish(emitValue(next, this.#gamut));
  }

  /** Switch the output space. The element owns its own state, so it applies
   * the choice rather than only announcing it. It also re-publishes the
   * colour, because narrowing the gamut would otherwise leave a stored value
   * the picker has just promised it will not emit. */
  #chooseGamut(gamut: Gamut): void {
    if (gamut.id === (this.#gamut ?? SRGB).id) return;
    const dialled = this.#currentColour();
    this.#gamut = gamut;
    this.dispatchEvent(
      new CustomEvent("gamutchange", { detail: { gamut }, bubbles: true, composed: true }),
    );
    // Keep it as the draft: widening later should restore the chroma the user
    // dialled rather than the chroma the narrower space clipped it to.
    this.#draft = dialled;
    this.#publish(emitValue(dialled, gamut));
    // The boundary nodes are cut per reference space, so the tree follows.
    this.#rebuild();
  }

  /** Emit a chosen colour verbatim. A preset is already canonical. */
  #pick(colour: string): void {
    this.#draft = null;
    this.#publish(colour);
    this.#commit(colour);
  }

  /** Record a committed colour. A drag emits for every value it passes
   * through, so recording there would bury the list in near-identical colours
   * from one gesture. Only a commit reaches here, meaning a pointer release,
   * a preset, or leaving the hex field. */
  #commit(colour: string): void {
    const recents = addRecent(this.#recents ?? this.#ownRecents, colour, this.#maxRecents);
    this.#ownRecents = recents;
    // A controlled list stays the caller's to set, as `value` would be were
    // this element not driving its own; the event is how they hear about it.
    if (this.#recents === null) this.#render();
    this.dispatchEvent(
      new CustomEvent("recentschange", { detail: { recents }, bubbles: true, composed: true }),
    );
  }

  /** The colour showing right now, committed. Bound once at build time, so the
   * colour is read back rather than closed over. */
  // Null while the dialled colour is outside the gamut, so a drag released in
  // a hatched region records nothing rather than the clamped near-miss.
  #commitCurrent = () => {
    const colour = recentValue(this.#currentColour(), this.#gamut);
    if (colour) this.#commit(colour);
  };

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
    this.#recentsRow = undefined;
    this.#recentButtons = [];
    this.#gamutButtons = [];
    this.#rows = [];
    this.#chart = undefined;
    // The old chart nodes are gone with the tree; stop watching them, or the
    // observer holds detached SVG alive and the fresh charts land behind them.
    this.#resize?.disconnect();
    this.#charts = [];
    this.#alphaRow = undefined;
    this.#preview = undefined;
    this.#oklchField = undefined;
    this.#rgbField = undefined;
    this.#hex = undefined;
    this.#name = undefined;
    this.#notice = undefined;
    this.#built = false;
    this.#render();
  }

  #render(): void {
    if (!this.isConnected) return;
    const model = pickerModel(this.#currentColour(), {
      layout: this.layout,
      parts: this.#parts,
      labels: this.#labels,
      gamut: this.#gamut,
      references: this.#references,
      gamutChoices: this.#gamutChoices,
    });
    if (!this.#built) this.#build(model);
    this.#update(model);
  }

  #build(model: ReturnType<typeof pickerModel>): void {
    const p = this.#prefix;
    this.className = `${p} ${p}--${model.layout}`;
    // The model resolves the reference list, including the sRGB outline a
    // wider output gamut gets for free. The boundary nodes are cut from that
    // list rather than from the raw property.
    this.#builtReferences = model.references;
    this.#builtScaleGamuts = model.scaleGamuts;

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

    // Cut the row even when the list is empty: it fills in as colours are
    // committed, and #updateRecents hides it until then. Building it here
    // rather than on first commit keeps it in document order without a
    // rebuild, which would drop focus from the slider that just committed.
    if (model.parts.recents) {
      this.#recentsRow = el("div", `${p}__recents`);
      this.append(this.#recentsRow);
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
      // The gesture ending is the commit, not each value it passed through.
      // `blur` catches the keyboard: arrowing along a slider should record once
      // the user moves on, not per step.
      slider.addEventListener("pointerup", this.#commitCurrent);
      slider.addEventListener("blur", this.#commitCurrent);
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

    // Alpha rides with the axes for layout but is not one of them. No chart and
    // no hatching, because transparency cannot put a colour out of gamut.
    if (model.withAlpha) {
      const root = el("div", `${p}__axis ${p}__alpha`);
      const head = el("span", `${p}__axis-head`);
      const label = el("span", `${p}__axis-label`);
      label.setAttribute("aria-hidden", "true");
      label.textContent = model.layout === "compact" ? "A" : "Alpha";
      const output = el("output", `${p}__axis-value`);
      head.append(label, output);

      const track = el("span", `${p}__track`);
      const fill = el("span", `${p}__track-fill`);
      const check = el("span", `${p}__alpha-check`);
      const ramp = el("span", `${p}__alpha-ramp`);
      fill.append(check, ramp);

      const slider = el("input", `${p}__slider`);
      slider.type = "range";
      slider.min = String(model.alpha.min);
      slider.max = String(model.alpha.max);
      slider.step = String(model.alpha.step);
      slider.setAttribute("aria-label", "Alpha");
      slider.addEventListener("input", () => {
        const a = Number(slider.value);
        // Opaque drops the key rather than storing `a: 1`, so one shape means
        // opaque everywhere.
        const { a: _drop, ...rest } = this.#currentColour();
        this.#emit(a >= 1 ? rest : { ...rest, a });
      });
      slider.addEventListener("pointerup", this.#commitCurrent);
      slider.addEventListener("blur", this.#commitCurrent);
      this.#contain(slider);

      track.append(fill, slider);
      root.append(head, track);
      axes.append(root);
      this.#alphaRow = { output, ramp, slider };
    }

    this.append(axes);

    if (model.withGamutSwitch) {
      const group = el("div", `${p}__gamut-switch`);
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Output gamut");
      for (const gamut of model.gamutChoices) {
        const button = el("button", `${p}__gamut-choice`);
        button.type = "button";
        button.textContent = gamut.label;
        button.setAttribute("aria-label", `Output in ${gamut.label}`);
        button.addEventListener("click", () => this.#chooseGamut(gamut));
        group.append(button);
        this.#gamutButtons.push({ button, gamut });
      }
      this.append(group);
    }

    if (model.withFooter) {
      const footer = el("div", `${p}__footer`);
      if (model.parts.preview) {
        this.#preview = el("span", `${p}__preview`);
        footer.append(this.#preview);
      }
      // One factory for all three fields. Each accepts any supported format
      // whichever one it displays, so `toOklch` parses rather than a
      // per-field parser: pasting a hex into the oklch field should work.
      const field = (kind: "oklch" | "rgb" | "hex", label: string) => {
        const input = el("input", `${p}__field ${p}__field--${kind}`);
        if (kind === "hex") input.classList.add(`${p}__hex`);
        input.spellcheck = false;
        input.setAttribute("aria-label", label);
        input.addEventListener("input", () => {
          const parsed = toOklch(input.value);
          if (parsed) this.#emit(parsed);
        });
        // Typing passes through half-entered colours, so the commit is leaving
        // the field rather than each keystroke.
        input.addEventListener("blur", this.#commitCurrent);
        this.#contain(input);
        footer.append(input);
        return input;
      };

      if (model.parts.oklchInput) this.#oklchField = field("oklch", "OKLCH colour");
      if (model.parts.rgbInput) this.#rgbField = field("rgb", "RGB colour");
      if (model.parts.hexInput) this.#hex = field("hex", "Hex colour");
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
      // input's, so nothing needs containing. #emit dispatches once.
      const pick = (event: PointerEvent) => {
        const r = root.getBoundingClientRect();
        if (!r.width || !r.height) return;
        this.#emit(
          chartPick(
            this.#currentColour(),
            axis,
            (event.clientX - r.left) / r.width,
            (r.bottom - event.clientY) / r.height,
            this.#gamut,
            this.#builtScaleGamuts,
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
      // The release is the commit; the drag itself is a continuous preview.
      root.addEventListener("pointerup", this.#commitCurrent);
    }

    const defs = svg("defs");
    const gradient = svg("linearGradient");
    // Gradient ids share a document-wide namespace, and a page may hold more
    // than one picker. Qualify with the element's own id when it has one.
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
    // One node per reference space, in the order given, so #updateChart can
    // write a `d` by index rather than rebuilding the set as the colour moves.
    const boundaries = this.#builtReferences.map((g) => {
      const path = svg("path", `${p}__gamut-boundary ${p}__gamut-boundary--${g.id}`);
      path.setAttribute("fill", "none");
      return path;
    });
    // Named on the line, one node per reference so #updateChart can move them
    // by index like everything else here. Each sits in a group because the
    // viewBox is stretched non-uniformly: text placed straight into it is huge
    // and squashed, so the group carries the counter-scale and the text keeps
    // plain coordinates.
    const labels: SVGTextElement[] = [];
    const labelGroups = this.#builtReferences.map((g) => {
      const group = svg("g");
      // Hidden until the observer has a size. A wrongly scaled label for a
      // frame reads worse than no label at all.
      group.style.display = "none";
      const text = svg("text", `${p}__gamut-label`);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("y", "-5");
      text.textContent = g.label;
      group.append(text);
      labels.push(text);
      return group;
    });
    const vertical = svg("line", `${p}__crosshair`);
    vertical.setAttribute("y1", "0");
    vertical.setAttribute("y2", String(CHART_H));
    const horizontal = svg("line", `${p}__crosshair`);
    horizontal.setAttribute("x1", "0");
    horizontal.setAttribute("x2", String(CHART_W));

    root.append(defs, area, line, ...boundaries, ...labelGroups, vertical, horizontal);
    const nodes: ChartNodes = {
      root,
      gradient,
      area,
      line,
      boundaries,
      labelGroups,
      vertical,
      horizontal,
      key: null,
      width: 0,
      height: 0,
      anchors: [],
    };
    // Observed rather than measured once: the chart is fluid, and only a live
    // size keeps the labels at the stylesheet's pixel size as it stretches.
    this.#observe(nodes);
    return nodes;
  }

  /** Watch one chart for size changes and re-place its labels. Only the label
   * groups move; the tree itself is never rebuilt, because rebuilding it would
   * drop focus from a slider mid-drag. */
  #observe(nodes: ChartNodes): void {
    this.#charts.push(nodes);
    this.#resize ??= new ResizeObserver((entries) => {
      for (const entry of entries) {
        const chart = this.#charts.find((c) => c.root === entry.target);
        if (!chart) continue;
        const r = entry.contentRect;
        if (chart.width === r.width && chart.height === r.height) continue;
        chart.width = r.width;
        chart.height = r.height;
        this.#placeLabels(chart);
      }
    });
    this.#resize.observe(nodes.root);
  }

  /** Put each label on its boundary's peak at the chart's current size. Called
   * both when the curve moves and when the chart is resized, since the
   * counter-scale depends on the rendered pixel size. */
  #placeLabels(nodes: ChartNodes): void {
    for (const [i, group] of nodes.labelGroups.entries()) {
      const anchor = nodes.anchors[i];
      const transform = anchor
        ? labelTransform(anchor.x, anchor.y, nodes.width, nodes.height)
        : null;
      if (transform) {
        attr(group, "transform", transform);
        group.style.display = "";
      } else {
        // No size yet, or no curve yet. A wrongly scaled label is worse than
        // none, so the group stays out of the picture entirely.
        group.style.display = "none";
      }
    }
  }

  #update(model: ReturnType<typeof pickerModel>): void {
    const p = this.#prefix;
    this.className = `${p} ${p}--${model.layout}`;

    for (const { button, colour } of this.#presetButtons) {
      const selected = colour === model.canonical;
      button.className = `${p}__preset${selected ? ` ${p}__preset--selected` : ""}`;
      button.setAttribute("aria-pressed", String(selected));
    }

    this.#updateRecents(model.canonical);

    for (const { button, gamut } of this.#gamutButtons) {
      attr(button, "aria-pressed", String(gamut.id === model.gamut.id));
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
      attr(this.#preview, "title", model.clipped ? model.notice : model.canonical);
    }
    // Never overwrite what is being typed. A half-entered hex is not a colour.
    if (this.#alphaRow) {
      this.#alphaRow.output.textContent = model.alpha.value.toFixed(2);
      this.#alphaRow.ramp.style.background = model.alpha.track;
      // Same rule as the axis sliders: do not fight a drag in progress.
      if (this.#alphaRow.slider !== this.ownerDocument.activeElement) {
        this.#alphaRow.slider.value = String(model.alpha.value);
      }
    }

    // Never overwrite the field being typed in. Re-rendering a half-entered
    // value under the caret would fight the person editing it.
    const active = this.ownerDocument.activeElement;
    if (this.#oklchField && this.#oklchField !== active) this.#oklchField.value = model.oklch;
    if (this.#rgbField && this.#rgbField !== active) this.#rgbField.value = model.rgb;
    if (this.#hex && this.#hex !== active) this.#hex.value = model.hex;
    if (this.#name) this.#name.textContent = model.name;
    if (this.#notice) {
      this.#notice.textContent = model.notice;
      this.#notice.hidden = !model.clipped;
    }
  }

  #updateChart(nodes: ChartNodes, slot: ChartSlot): void {
    const axis = slot.axis;
    // The curve and its stops depend on one input; rebuild only when it moves.
    if (nodes.key !== slot.key) {
      const m = gamutChartModel(
        chartBase(slot.key, axis),
        axis,
        undefined,
        this.#builtReferences,
        this.#gamut,
        // Every space in view, not just the drawn ones. Without this the chart
        // falls back to scaling by what it draws, so a Rec. 2020 picker and a
        // P3 picker use different rulers and the wider one can look shorter.
        this.#builtScaleGamuts,
      );
      nodes.area.setAttribute("d", `M0,${CHART_H} L${m.path} L${CHART_W},${CHART_H} Z`);
      nodes.line.setAttribute("d", `M${m.path}`);
      // Aligned by construction: both lists come from #builtReferences, and a
      // change to it rebuilds the tree rather than reaching this path.
      for (const [i, b] of m.boundaries.entries()) {
        nodes.boundaries[i]?.setAttribute("d", `M${b.path}`);
      }
      // The labels move with the curve, but their transform also depends on the
      // chart's pixel size, so the anchors are stored and the placing is shared
      // with the resize path.
      nodes.anchors = m.boundaries.map((b) => ({ x: b.labelX, y: b.labelY }));
      this.#placeLabels(nodes);
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

  /** The one row here whose length changes: a colour joins the front on every
   * commit. Rebuilding just these children is cheap and, unlike a rebuild of
   * the tree, leaves the slider that raised the commit still focused. */
  #updateRecents(canonical: string): void {
    const row = this.#recentsRow;
    if (!row) return;
    const p = this.#prefix;
    const recents = this.#recents ?? this.#ownRecents;

    // The list grows and reorders, so a pooled button would have to be re-bound
    // to a different colour anyway. Cutting the children afresh is simpler and
    // costs nothing next to how rarely a commit happens.
    const stale =
      this.#recentButtons.length !== recents.length ||
      this.#recentButtons.some((b, i) => b.colour !== recents[i]);
    if (stale) {
      this.#recentButtons = recents.map((colour) => {
        const button = el("button", `${p}__recent`);
        button.type = "button";
        button.style.background = colour;
        button.setAttribute("aria-label", `Recent: ${colourName(colour)}`);
        button.addEventListener("click", () => this.#pick(colour));
        return { button, colour };
      });
      row.replaceChildren(...this.#recentButtons.map((b) => b.button));
    }
    // Empty is not "no row" but "a row with nothing in it"; hide it so the
    // layout gap goes with it.
    row.hidden = recents.length === 0;

    // Selection follows the colour, not the list, so it is written every
    // render rather than only when the buttons are cut.
    for (const { button, colour } of this.#recentButtons) {
      const selected = colour === canonical;
      button.className = `${p}__recent${selected ? ` ${p}__recent--selected` : ""}`;
      attr(button, "aria-pressed", String(selected));
    }
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

/** Register the element. Explicit, so importing the class has no side effect.
 * `import "oklch-picker/vanilla/register"` does this for you. */
export function register(tag = "oklch-picker"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  customElements.define(tag, OklchPickerElement);
}

/** The `change` event the element emits. `detail.colour` is canonical and
 * gamut-clamped. */
export type OklchPickerChangeEvent = CustomEvent<{ colour: string }>;

/** The `gamutchange` event a switcher button raises. The element has already
 * applied the choice; a `change` with the re-clamped colour follows. */
export type OklchPickerGamutChangeEvent = CustomEvent<{ gamut: Gamut }>;

/** The `recentschange` event raised when a colour is committed, so on a
 * pointer release, a preset, or leaving the hex field. Not on every value a
 * drag passes through. `detail.recents` is the whole list, most recent
 * first. */
export type OklchPickerRecentsChangeEvent = CustomEvent<{ recents: string[] }>;

declare global {
  interface HTMLElementTagNameMap {
    "oklch-picker": OklchPickerElement;
  }

  /** So `picker.addEventListener("change", e => e.detail.colour)` types. */
  interface OklchPickerElementEventMap extends HTMLElementEventMap {
    change: OklchPickerChangeEvent;
    gamutchange: OklchPickerGamutChangeEvent;
    recentschange: OklchPickerRecentsChangeEvent;
  }
}

/** Narrows `addEventListener` on the element so `change` carries the colour.
 * This merges with the class above. That is the standard way to type a custom
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
