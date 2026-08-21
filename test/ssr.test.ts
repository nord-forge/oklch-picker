/** Server rendering: nothing here may touch the DOM at import time.
 *
 * Runs in the `node` environment on purpose, with no happy-dom, so a stray
 * `document` reference fails rather than quietly finding a global. */
import { describe, expect, test } from "vitest";

describe("importing on a server", () => {
  test("the DOM globals really are absent", () => {
    // If this fails the project is configured wrong and the rest proves nothing.
    expect(typeof document).toBe("undefined");
    expect(typeof HTMLElement).toBe("undefined");
  });

  test("the core imports and computes without a DOM", async () => {
    const { pickerModel, emitValue } = await import("@oklch-picker/core");
    const model = pickerModel({ l: 0.7, c: 0.15, h: 255 });
    expect(model.axes).toHaveLength(3);
    expect(emitValue(model.current)).toBe("oklch(0.7 0.15 255)");
  });

  test("the gamuts entry imports without a DOM", async () => {
    const { P3, REC2020 } = await import("@oklch-picker/core/gamuts");
    expect(P3.id).toBe("p3");
    expect(REC2020.id).toBe("rec2020");
  });

  // Regression: `class X extends HTMLElement` evaluates at import time, so the
  // module threw `HTMLElement is not defined` in Node. Any JavaScript SSR that
  // imported it outside a client-only block crashed the render.
  test("the custom element imports without a DOM", async () => {
    const mod = await import("oklch-picker");
    expect(typeof mod.OklchPickerElement).toBe("function");
  });

  test("register is a no-op with no customElements", async () => {
    const { register } = await import("oklch-picker");
    expect(() => register()).not.toThrow();
  });

  test("the side-effect entry does not throw either", async () => {
    await expect(import("oklch-picker/register")).resolves.toBeDefined();
  });
});
