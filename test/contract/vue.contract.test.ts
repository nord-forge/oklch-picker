/** Vue against the shared contract, plus what only Vue does. */
import type { Gamut } from "@oklch-picker/core";
import { ColourPicker } from "@oklch-picker/vue";
import { type VueWrapper, mount } from "@vue/test-utils";
import { expect, test } from "vitest";
import { adapterContract } from "./contract.js";
import type { Mounted, PickerProps } from "./driver.js";

const mounted: VueWrapper[] = [];

adapterContract({
  name: "Vue",
  cleanup() {
    for (const w of mounted.splice(0)) w.unmount();
  },
  async mount(props: PickerProps): Promise<Mounted> {
    const emitted: string[] = [];
    const recents: string[][] = [];
    const gamuts: Gamut[] = [];

    // Only the keys that were actually set. `exactOptionalPropertyTypes` makes
    // an explicit `undefined` a different thing from an absent prop, and Vue's
    // prop types say absent.
    const { value, ...rest } = props;
    const defined = Object.fromEntries(
      Object.entries({ modelValue: value, ...rest }).filter(([, v]) => v !== undefined),
    );
    // Into a container of our own, because `w.element` is the picker's root
    // rather than a wrapper around it, and the contract queries for the root's
    // own classes.
    const host = document.createElement("div");
    document.body.append(host);
    const w = mount(ColourPicker, { props: defined, attachTo: host });
    mounted.push(w);

    // Controlled, the way `v-model` drives it: what the picker emits goes
    // straight back in, so a clamped value is read back through
    // `resolveCurrent`.
    const sync = async () => {
      const model = (w.emitted("update:modelValue") ?? []).map((e) => (e as string[])[0] as string);
      for (const c of model.slice(emitted.length)) emitted.push(c);
      const last = emitted.at(-1);
      if (last !== undefined) await w.setProps({ modelValue: last });

      for (const e of (w.emitted("recentsChange") ?? []).slice(recents.length)) {
        recents.push((e as string[][])[0] as string[]);
      }
      for (const e of (w.emitted("gamutChange") ?? []).slice(gamuts.length)) {
        gamuts.push((e as Gamut[])[0] as Gamut);
      }
    };

    return {
      root: host,
      emitted,
      recents,
      gamuts,
      async set(el, value) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await w.vm.$nextTick();
        await sync();
      },
      async click(el) {
        (el as HTMLElement).click();
        await w.vm.$nextTick();
        await sync();
      },
      async drag(el, x, y) {
        // happy-dom lays nothing out, so the chart has no size and a pick would
        // divide by zero. Stub the box the adapter measures, and the pointer
        // capture it takes to keep a drag alive off-element.
        const svg = el as SVGSVGElement;
        svg.getBoundingClientRect = () =>
          ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
        svg.setPointerCapture = () => {};
        svg.hasPointerCapture = () => true;
        el.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: x * 200,
            clientY: 100 - y * 100,
          }),
        );
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
        await w.vm.$nextTick();
        await sync();
      },
      async blur(el) {
        el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
        await w.vm.$nextTick();
        await sync();
      },
      async release(el) {
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
        await w.vm.$nextTick();
        await sync();
      },
    };
  },
});

test("the change event mirrors v-model, for callers not using it", async () => {
  const w = mount(ColourPicker, { props: { modelValue: "oklch(0.7 0.15 255)" } });
  await w.find('input[aria-label="Hue"]').setValue("120");
  expect(w.emitted("update:modelValue")).toBeTruthy();
  expect(w.emitted("change")).toBeTruthy();
  w.unmount();
});
