/** Qwik against the shared contract, plus what only Qwik does. */
import { $, component$, useSignal } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import type { Gamut } from "@oklch-picker/core";
import { ColourPicker, type GamutId } from "@oklch-picker/qwik";
import { expect, test } from "vitest";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

/** The contract passes `Gamut` objects, since it describes behaviour rather
 * than any one adapter's spelling of it. This adapter takes ids, because Qwik
 * serialises props and a `Gamut` carries a function. */
const idOf = (g?: Gamut): GamutId | undefined => g?.id as GamutId | undefined;

adapterContract({
  name: "Qwik",
  async mount(props: PickerProps): Promise<Mounted> {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];

    // Flattened to ids *before* the component exists. A `component$` closes
    // over what it references, and Qwik serialises that closure, so holding
    // `props` here would drag the `Gamut` objects (and `fromLms`) in with it.
    const flat = {
      value: props.value,
      presets: props.presets,
      recents: props.recents,
      maxRecents: props.maxRecents,
      layout: props.layout,
      parts: props.parts,
      labels: props.labels,
      gamut: idOf(props.gamut),
      references: props.references?.map((g) => g.id as GamutId),
      gamutChoices: props.gamutChoices?.map((g) => g.id as GamutId),
      classPrefix: props.classPrefix,
    };

    const Host = component$(() => {
      const colour = useSignal(flat.value);
      return (
        <ColourPicker
          value={colour.value}
          presets={flat.presets}
          recents={flat.recents}
          maxRecents={flat.maxRecents}
          layout={flat.layout}
          parts={flat.parts}
          labels={flat.labels}
          gamut={flat.gamut}
          references={flat.references}
          gamutChoices={flat.gamutChoices}
          classPrefix={flat.classPrefix}
          onChange$={$((c: string) => {
            emitted.push(c);
            // Controlled, so a clamped emit is read back through
            // `resolveCurrent`.
            colour.value = c;
          })}
          onRecentsChange$={$((r: string[]) => {
            recents.push(r);
          })}
          onGamutChange$={$((g: GamutId) => {
            // Back to an object, so the contract can compare ids either way.
            gamuts.push({ id: g } as Gamut);
          })}
        />
      );
    });

    const dom = await createDOM();
    await dom.render(<Host />);

    // Qwik's `screen` is a real element wrapping the picker, but its
    // `querySelector` returns `undefined` for a miss where the DOM returns
    // `null`. The contract asserts `toBeNull`, so normalise here rather than
    // loosening every assertion for one adapter's harness.
    const host = dom.screen as unknown as HTMLElement;
    const root = new Proxy(host, {
      get(target, prop, receiver) {
        if (prop === "querySelector") {
          return (sel: string) => target.querySelector(sel) ?? null;
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? v.bind(target) : v;
      },
    }) as HTMLElement;

    const fire = async (el: Element, event: string) => {
      await dom.userEvent(el as never, event);
    };

    return {
      root,
      emitted,
      recents,
      gamuts,
      async set(el, value) {
        el.value = value;
        await fire(el, "input");
      },
      click: (el) => fire(el, "click"),
      async drag(el, x, y) {
        // happy-dom lays nothing out, so the chart has no size and a pick would
        // divide by zero.
        const svg = el as SVGSVGElement;
        svg.getBoundingClientRect = () =>
          ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
        svg.setPointerCapture = () => {};
        svg.hasPointerCapture = () => true;
        await dom.userEvent(el as never, "pointerdown", {
          pointerId: 1,
          clientX: x * 200,
          clientY: 100 - y * 100,
        });
        await dom.userEvent(el as never, "pointerup", { pointerId: 1 });
      },
      blur: (el) => fire(el, "blur"),
      release: (el) => fire(el, "pointerup"),
    };
  },
});

test("a gamut id crosses the serialisation boundary where the object cannot", async () => {
  const Host = component$(() => <ColourPicker value="oklch(0.7 0.15 255)" gamut="p3" />);
  const { screen, render } = await createDOM();
  await render(<Host />);
  // Resolved from the id: a P3 picker outlines sRGB as a reference.
  expect(screen.querySelector(".oklch-picker__gamut-boundary--srgb")).toBeTruthy();
});
