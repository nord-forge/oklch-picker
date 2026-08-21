/** What an adapter has to provide for the shared contract to run against it.
 *
 * Seven adapters were testing the same behaviour seven times, and the counts
 * showed why that is a problem rather than merely repetitive: React covered 37
 * behaviours, Qwik 13. The newest adapters were the least tested, and nothing
 * in the code made that visible. A contract fixes the asymmetry by construction
 * — a new adapter either satisfies it or fails.
 *
 * The driver is deliberately small. Everything the contract needs is mounting
 * with props, reading the DOM, driving an input, and reading what was emitted.
 * Anything an adapter does uniquely stays in its own file: Qwik's serialisation
 * rules, vanilla's form association, Angular's change detection. Folding those
 * in here would mean capability flags, and a skipped test reads too much like a
 * passing one.
 */
import type { Gamut } from "@oklch-picker/core";

/** The props the contract sets. A superset of what any one test uses.
 *
 * `gamut` is a `Gamut` here even though Qwik's adapter takes an id string. Its
 * driver maps one to the other, because the contract describes behaviour rather
 * than any single adapter's spelling of it. */
export interface PickerProps {
  value?: string;
  presets?: string[];
  recents?: string[];
  maxRecents?: number;
  layout?: "chart" | "stacked" | "compact" | "side-by-side";
  parts?: Record<string, boolean>;
  labels?: Record<string, string>;
  gamut?: Gamut;
  references?: Gamut[];
  gamutChoices?: Gamut[];
  classPrefix?: string;
}

/** One mounted picker, and the handles the contract needs on it. */
export interface Mounted {
  /** The element the picker rendered into. */
  readonly root: HTMLElement;
  /** Every colour passed to the change callback, in order. */
  readonly emitted: readonly string[];
  /** Every recents list passed to the recents callback, in order. */
  readonly recents: readonly string[][];
  /** Every gamut passed to the gamut callback, in order. */
  readonly gamuts: readonly Gamut[];
  /** Set a range input or text field and let the adapter settle.
   *
   * Adapters differ on which event commits a value, and some need an explicit
   * flush afterwards, so this is the driver's job rather than the contract's. */
  set(el: HTMLInputElement, value: string): Promise<void> | void;
  /** Click, and let the adapter settle. */
  click(el: Element): Promise<void> | void;
  /** Fire a pointer sequence on the chart, in 0..1 plot coordinates. */
  drag(el: Element, x: number, y: number): Promise<void> | void;
  /** Release focus, which is what commits a text field. */
  blur(el: Element): Promise<void> | void;
  /** End a pointer gesture on a slider. The release is the commit, not each
   * value the drag passed through, so recents depend on this firing. */
  release(el: Element): Promise<void> | void;
}

export interface Driver {
  /** Shown in the suite name. */
  readonly name: string;
  /** Render a picker and return the handles above. */
  mount(props: PickerProps): Mounted | Promise<Mounted>;
  /** Tear down between tests. */
  cleanup?(): void | Promise<void>;
  /** Behaviours this adapter cannot express, with the reason.
   *
   * Not a capability flag for tuning coverage: the contract fails loudly for
   * anything not listed here, and every entry needs a reason a reader can
   * check. An empty object is the goal. */
  readonly unsupported?: Readonly<Record<string, string>>;
}
