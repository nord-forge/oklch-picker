/** What a server sends has to match what the client renders first.
 *
 * Hydration compares the two and, on a mismatch, throws the server markup away
 * and re-renders. That costs the flash the server render was meant to avoid, so
 * a mismatch is a silent performance bug rather than a loud one. These pin the
 * properties hydration depends on, at the model layer where all five adapters
 * share them.
 */
import { describe, expect, test } from "vitest";
import { SRGB } from "../packages/core/src/colour.js";
import {
  chartBase,
  chartSlot,
  emitValue,
  gamutChartModel,
  pickerModel,
  resolveCurrent,
} from "../packages/core/src/model.js";

const COLOUR = "oklch(0.7 0.15 255)";

describe("the model is a pure function of its input", () => {
  // A server and a client run this separately, so anything that varies between
  // two calls with the same input shows up as a hydration mismatch.
  test("two models of the same colour are deeply equal", () => {
    const a = pickerModel({ l: 0.7, c: 0.15, h: 255 });
    const b = pickerModel({ l: 0.7, c: 0.15, h: 255 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("the chart path and its stops are stable", () => {
    const a = gamutChartModel(chartBase(255, "h"), "h", 64, [], SRGB);
    const b = gamutChartModel(chartBase(255, "h"), "h", 64, [], SRGB);
    expect(a.path).toBe(b.path);
    expect(a.stops).toEqual(b.stops);
  });

  test("the crosshair lands in the same place twice", () => {
    const current = { l: 0.7, c: 0.15, h: 255 };
    expect(chartSlot(current, "h")).toEqual(chartSlot(current, "h"));
  });
});

describe("the server has no draft to read", () => {
  // `resolveCurrent` prefers the draft, which only exists once someone has
  // dragged something. On a server there is none, so it must fall through to
  // the stored value rather than to the fallback colour.
  test("a null draft resolves to the stored value", () => {
    expect(resolveCurrent(null, COLOUR)).toEqual({ l: 0.7, c: 0.15, h: 255 });
  });

  test("an unparseable value resolves the same on both sides", () => {
    // Whatever it falls back to, it has to be the same colour in both renders.
    expect(resolveCurrent(null, "nonsense")).toEqual(resolveCurrent(null, "nonsense"));
  });

  test("the first client render matches the server when nothing has been dragged", () => {
    const server = pickerModel(resolveCurrent(null, COLOUR));
    const client = pickerModel(resolveCurrent(null, COLOUR));
    expect(JSON.stringify(server)).toBe(JSON.stringify(client));
  });
});

describe("what the server emits round-trips", () => {
  test("the emitted value parses back to the same colour", () => {
    const current = resolveCurrent(null, COLOUR);
    expect(emitValue(current)).toBe(COLOUR);
  });

  test("alpha survives a server render", () => {
    const current = resolveCurrent(null, "oklch(0.7 0.15 255 / 0.4)");
    expect(emitValue(current)).toBe("oklch(0.7 0.15 255 / 0.4)");
  });
});
