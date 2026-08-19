import { describe, expect, test } from "vitest";
import {
  clampToGamut,
  colourName,
  formatOklch,
  gamutCurve,
  hexToOklch,
  inGamut,
  isLight,
  maxChroma,
  oklchToHex,
  parseOklch,
  toOklch,
} from "../packages/core/src/colour.js";

describe("parse / format", () => {
  test("parses the stored form", () => {
    expect(parseOklch("oklch(0.75 0.16 145)")).toEqual({ l: 0.75, c: 0.16, h: 145 });
  });

  test("rejects other forms", () => {
    expect(parseOklch("#ff0000")).toBeNull();
    expect(parseOklch("red")).toBeNull();
    expect(parseOklch(null)).toBeNull();
    expect(parseOklch("")).toBeNull();
  });

  test("formats with hue wrapped into 0..360", () => {
    expect(formatOklch({ l: 0.7, c: 0.15, h: 400 })).toBe("oklch(0.7 0.15 40)");
    expect(formatOklch({ l: 0.7, c: 0.15, h: -20 })).toBe("oklch(0.7 0.15 340)");
  });

  test("toOklch accepts either stored form", () => {
    expect(toOklch("oklch(0.75 0.16 145)")).toEqual({ l: 0.75, c: 0.16, h: 145 });
    expect(toOklch("#ff0000")).not.toBeNull();
    expect(toOklch("nonsense")).toBeNull();
  });
});

describe("hex <-> oklch round-trip", () => {
  // The picker converts on every drag, so drift here would be visible.
  const HEXES = [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffffff",
    "#000000",
    "#808080",
    "#e26e5a",
    "#4a90d9",
    "#7fc242",
    "#ffcc00",
    "#123456",
    "#abcdef",
  ];

  for (const hex of HEXES) {
    test(`${hex} survives hex -> oklch -> hex`, () => {
      const c = hexToOklch(hex);
      expect(c).not.toBeNull();
      expect(oklchToHex(c as NonNullable<typeof c>)).toBe(hex);
    });
  }

  test("accepts shorthand and a missing #", () => {
    expect(oklchToHex(hexToOklch("#abc") as never)).toBe("#aabbcc");
    expect(oklchToHex(hexToOklch("abcdef") as never)).toBe("#abcdef");
  });

  test("rejects malformed hex", () => {
    expect(hexToOklch("#ab")).toBeNull();
    expect(hexToOklch("#gggggg")).toBeNull();
    expect(hexToOklch("")).toBeNull();
  });

  test("greys report hue 0 rather than atan2 noise", () => {
    const grey = hexToOklch("#808080");
    expect(grey?.c).toBeLessThan(1e-6);
    expect(grey?.h).toBe(0);
  });
});

describe("gamut", () => {
  test("sRGB colours are in gamut", () => {
    expect(inGamut({ l: 0.75, c: 0.16, h: 145 })).toBe(true);
    expect(inGamut({ l: 0.5, c: 0, h: 0 })).toBe(true);
  });

  test("impossible chroma is out of gamut", () => {
    expect(inGamut({ l: 0.75, c: 0.35, h: 145 })).toBe(false);
  });

  // Regression: these two disagreed near black — maxChroma returned 0 while
  // inGamut still said true, so the picker drew a crosshair above the curve and
  // showed no out-of-gamut notice for a colour it could not display.
  test("inGamut and maxChroma agree everywhere, near black included", () => {
    for (const h of [0, 60, 145, 200, 263, 320]) {
      for (let l = 0; l <= 1.0001; l += 0.02) {
        const limit = maxChroma(l, h);
        // Anything past the reported limit must be reported as out of gamut.
        expect(inGamut({ l, c: limit + 0.01, h })).toBe(false);
        if (limit > 0) expect(inGamut({ l, c: limit, h })).toBe(true);
      }
    }
  });

  test("clamping keeps lightness and hue, reduces chroma", () => {
    const wanted = { l: 0.75, c: 0.35, h: 145 };
    const got = clampToGamut(wanted);
    expect(got.l).toBe(wanted.l);
    expect(got.h).toBe(wanted.h);
    expect(got.c).toBeLessThan(wanted.c);
    expect(inGamut(got)).toBe(true);
  });

  test("clamping leaves in-gamut colours untouched", () => {
    const c = { l: 0.75, c: 0.16, h: 145 };
    expect(clampToGamut(c)).toEqual(c);
  });

  test("out-of-gamut colours still produce valid hex", () => {
    expect(oklchToHex({ l: 0.75, c: 0.35, h: 145 })).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("maxChroma", () => {
  test("returns an in-gamut chroma that is at the boundary", () => {
    for (const [l, h] of [
      [0.3, 145],
      [0.7, 145],
      [0.7, 260],
      [0.9, 60],
    ] as const) {
      const m = maxChroma(l, h);
      expect(inGamut({ l, c: m, h })).toBe(true);
      // Just past the boundary must be out of gamut.
      expect(inGamut({ l, c: m + 0.01, h })).toBe(false);
    }
  });

  test("peak chroma depends on lightness — a fixed slider max is mostly dead", () => {
    // This is why the chroma slider is capped dynamically.
    expect(maxChroma(0.1, 145)).toBeLessThan(maxChroma(0.7, 145));
    expect(maxChroma(0.99, 145)).toBeLessThan(maxChroma(0.7, 145));
  });

  test("collapses towards white", () => {
    expect(maxChroma(0.999, 145)).toBeLessThan(0.02);
    expect(maxChroma(1, 145)).toBeLessThan(0.02);
  });

  test("is zero at pure black", () => {
    expect(maxChroma(0, 145)).toBe(0);
  });

  // Regression: inGamut applied its tolerance to linear light, which near black
  // is worth ~1.6/255 and admitted chroma no screen can show. maxChroma papered
  // over it by returning 0 below L=0.06, which zeroed a real region instead.
  test("the near-black gamut is small but not flat-zeroed", () => {
    for (const h of [0, 145, 263]) {
      // It opens up gradually rather than switching on at a threshold. How
      // early depends on the hue — green needs more lightness than blue before
      // any chroma survives quantisation — so this only pins the ordering.
      expect(maxChroma(0.08, h)).toBeGreaterThan(0);
      expect(maxChroma(0.08, h)).toBeGreaterThan(maxChroma(0.03, h));
      // And stays narrow — this is near black, not a phantom peak.
      expect(maxChroma(0.08, h)).toBeLessThan(0.1);
    }
    // Blue reaches furthest at a given low lightness; the old L<=0.06 cutoff
    // reported zero for all of it.
    expect(maxChroma(0.04, 263)).toBeGreaterThan(0);
  });

  test("reports only chroma that survives 8-bit quantisation", () => {
    // Every chroma inside the reported limit is a different pixel from grey.
    for (const l of [0.02, 0.05, 0.1, 0.5]) {
      const limit = maxChroma(l, 263);
      if (limit === 0) continue;
      expect(oklchToHex({ l, c: limit, h: 263 })).not.toBe(oklchToHex({ l, c: 0, h: 263 }));
    }
  });
});

describe("gamutCurve", () => {
  test("sweeps the requested axis and returns paintable columns", () => {
    const cols = gamutCurve({ l: 0.7, c: 0.15, h: 145 }, "l", 16);
    expect(cols).toHaveLength(17); // inclusive of both ends
    expect(cols[0]?.t).toBe(0);
    expect(cols[16]?.t).toBe(1);
    for (const c of cols) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("the lightness silhouette rises to a peak and falls away", () => {
    const cols = gamutCurve({ l: 0.5, c: 0.1, h: 145 }, "l", 64);
    const peak = cols.reduce((a, b) => (b.c > a.c ? b : a));
    // Peak sits mid-to-high, not jammed against either end.
    expect(peak.t).toBeGreaterThan(0.4);
    expect(peak.t).toBeLessThan(0.95);
    // Both ends collapse to greyscale.
    expect(cols[0]?.c).toBeLessThan(0.01);
    expect(cols[64]?.c).toBeLessThan(0.01);
  });

  // Regression: inGamut's absolute tolerance used to accept chroma near black,
  // producing a false spike (0.18 at L=0.03) that drew a phantom peak.
  test("no phantom chroma spike at the dark end", () => {
    for (const h of [0, 60, 145, 200, 260, 320]) {
      const cols = gamutCurve({ l: 0.5, c: 0.1, h }, "l", 64);
      const peak = cols.reduce((a, b) => (b.c > a.c ? b : a));
      expect(peak.t).toBeGreaterThan(0.4);
    }
  });

  test("the hue silhouette varies with hue", () => {
    const cols = gamutCurve({ l: 0.7, c: 0.15, h: 0 }, "h", 32);
    const values = cols.map((c) => c.c);
    expect(Math.max(...values)).toBeGreaterThan(Math.min(...values) + 0.05);
  });
});

describe("colourName", () => {
  test("names by hue", () => {
    expect(colourName("oklch(0.75 0.16 145)")).toBe("Green");
    expect(colourName("oklch(0.7 0.15 255)")).toBe("Blue");
    expect(colourName("oklch(0.76 0.15 60)")).toBe("Amber");
  });

  test("hue alone is not enough — lightness and chroma qualify it", () => {
    // All hue 338, but visibly different colours.
    expect(colourName("oklch(0.43 0.19 338)")).toBe("Dark pink");
    expect(colourName("oklch(0.7 0.15 338)")).toBe("Pink");
    expect(colourName("oklch(0.88 0.06 338)")).toBe("Pale pink");
    expect(colourName("oklch(0.7 0.05 338)")).toBe("Muted pink");
  });

  test("near-greys are named by lightness, not hue", () => {
    expect(colourName("oklch(0.98 0.01 0)")).toBe("White");
    expect(colourName("oklch(0.85 0.01 0)")).toBe("Light grey");
    expect(colourName("oklch(0.5 0.01 0)")).toBe("Grey");
    expect(colourName("oklch(0.2 0.01 0)")).toBe("Dark grey");
    expect(colourName("oklch(0.03 0.01 0)")).toBe("Black");
  });

  test("hue wraps past the last bucket back to red", () => {
    expect(colourName("oklch(0.7 0.15 355)")).toBe("Red");
    expect(colourName("oklch(0.7 0.15 5)")).toBe("Red");
  });

  test("names hex too, since it parses to oklch", () => {
    expect(colourName("#4a90d9")).toBe("Blue");
  });

  test("falls back for missing or unparseable values", () => {
    expect(colourName(null)).toBe("Default");
    expect(colourName("")).toBe("Default");
    expect(colourName("garbage")).toBe("Custom");
  });
});

describe("isLight", () => {
  test("picks readable foregrounds", () => {
    expect(isLight(hexToOklch("#ffffff") as never)).toBe(true);
    expect(isLight(hexToOklch("#ffcc00") as never)).toBe(true);
    expect(isLight(hexToOklch("#000000") as never)).toBe(false);
    expect(isLight(hexToOklch("#123456") as never)).toBe(false);
  });
});
