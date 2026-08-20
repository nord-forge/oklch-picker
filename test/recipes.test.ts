/** The claims the Lit and Alpine recipes make, pinned.
 *
 * `/docs/recipes` tells people to write specific bindings, and the reason those
 * pages exist is that the obvious binding is the wrong one. A docs page cannot
 * fail CI, so the promises live here instead: if the element ever stops working
 * this way, these break rather than the recipe quietly becoming wrong.
 *
 * HTMX is absent on purpose. Its recipe rests on form association, which needs
 * `ElementInternals`, and happy-dom has none. That path is verified in a real
 * browser, as `packages/vanilla`'s own suite notes.
 */
import { P3 } from "@oklch-picker/core/gamuts";
import Alpine from "alpinejs";
import { LitElement, html } from "lit";
import "oklch-picker/register";
import { afterEach, describe, expect, test } from "vitest";

afterEach(() => {
  document.body.innerHTML = "";
});

const settle = () => new Promise((r) => setTimeout(r, 20));

/** Drag the first slider, which is the gesture every recipe has to survive. */
async function drag(picker: Element | null, to: number) {
  const slider = picker?.querySelector<HTMLInputElement>("input[type=range]");
  if (!slider) throw new Error("no slider in the picker");
  slider.value = String(to);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

describe("the Lit recipe", () => {
  class ColourField extends LitElement {
    static override properties = { colour: { state: true } };

    declare colour: string;

    // Assigned here rather than as a class field. A native class field
    // overwrites the accessor Lit installs and updates stop firing, which is
    // the gotcha the recipe warns about.
    constructor() {
      super();
      this.colour = "oklch(0.7 0.15 255)";
    }

    // The stylesheet is a document-level sheet, so a shadow root would leave
    // the picker unstyled. The recipe says to opt out; this is that.
    protected override createRenderRoot() {
      return this;
    }

    override render() {
      return html`
        <oklch-picker
          .value=${this.colour}
          .gamut=${P3}
          .presets=${["oklch(0.75 0.16 145)"]}
          @change=${(e: CustomEvent<{ colour: string }>) => {
            this.colour = e.detail.colour;
          }}
        ></oklch-picker>
      `;
    }
  }
  customElements.define("colour-field", ColourField);

  async function mount() {
    const host = document.createElement("colour-field") as ColourField;
    document.body.append(host);
    await host.updateComplete;
    return host;
  }

  test("object properties bind through Lit's dot syntax", async () => {
    const host = await mount();
    const picker = host.querySelector("oklch-picker");
    // An attribute would stringify these, which is why the recipe insists on
    // the leading dot.
    expect(picker?.gamut?.id).toBe("p3");
    expect(picker?.presets).toEqual(["oklch(0.75 0.16 145)"]);
  });

  test("the change event flows back into Lit state", async () => {
    const host = await mount();
    await drag(host.querySelector("oklch-picker"), 0.4);
    expect(host.colour).toMatch(/^oklch\(/);
    expect(host.colour).not.toBe("oklch(0.7 0.15 255)");
  });
});

describe("the Alpine recipe", () => {
  /** Alpine binds once per document, so each case gets its own markup and a
   * fresh start rather than a shared root. */
  async function run(markup: string) {
    document.body.innerHTML = markup;
    Alpine.start();
    await settle();
    return {
      picker: document.querySelector("oklch-picker"),
      state: () => document.querySelector("#out")?.textContent ?? "",
    };
  }

  test("x-effect keeps the picker and the state in step", async () => {
    const { picker, state } = await run(
      `<div x-data="{ colour: 'oklch(0.7 0.15 255)' }">
         <oklch-picker
           x-effect="$el.value = colour"
           @change="colour = $event.detail.colour"
         ></oklch-picker>
         <p id="out" x-text="colour"></p>
       </div>`,
    );
    expect(state()).toBe("oklch(0.7 0.15 255)");
    await drag(picker, 0.4);
    expect(state()).toMatch(/^oklch\(/);
    expect(state()).not.toBe("oklch(0.7 0.15 255)");
  });

  test("x-model sets the initial value and then stops tracking", async () => {
    // This is why the recipe says not to use it. The binding looks correct and
    // silently goes stale after the first drag, so the failure has to be
    // written down somewhere it cannot rot.
    const { picker, state } = await run(
      `<div x-data="{ colour: 'oklch(0.7 0.15 255)' }">
         <oklch-picker x-model="colour"></oklch-picker>
         <p id="out" x-text="colour"></p>
       </div>`,
    );
    expect(state()).toBe("oklch(0.7 0.15 255)");
    await drag(picker, 0.4);
    expect(state()).toBe("oklch(0.7 0.15 255)");
  });
});
