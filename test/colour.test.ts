import { describe, expect, test } from "vitest";
import {
  CHART_MAX_CHROMA,
  MAX_CHART_COLUMNS,
  SRGB,
  alphaOf,
  clampToGamut,
  colourName,
  formatHsl,
  formatHwb,
  formatOklch,
  formatRgb,
  gamutCurve,
  hasAlpha,
  hexToOklch,
  inGamut,
  isLight,
  maxChroma,
  oklchToHex,
  oklchToRgb255,
  parseHsl,
  parseHwb,
  parseOklch,
  parseRgb,
  toOklch,
} from "../packages/core/src/colour.js";
import type { Oklch } from "../packages/core/src/colour.js";
import { P3, REC2020 } from "../packages/core/src/gamuts.js";
import {
  DEFAULT_LABELS,
  DEFAULT_MAX_RECENTS,
  addRecent,
  chartBase,
  chartPick,
  chartScale,
  gamutChartModel,
  pickerModel,
  recentValue,
} from "../packages/core/src/model.js";

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

  test("toOklch accepts every stored form", () => {
    expect(toOklch("oklch(0.75 0.16 145)")).toEqual({ l: 0.75, c: 0.16, h: 145 });
    expect(toOklch("#ff0000")).not.toBeNull();
    expect(toOklch("rgb(255 0 0)")).not.toBeNull();
    expect(toOklch("nonsense")).toBeNull();
  });
});

describe("alpha", () => {
  // An opaque colour must keep the exact strings 1.x emitted, or every stored
  // value in every existing app changes on upgrade for no reason.
  test("opaque colours keep the short form everywhere", () => {
    expect(formatOklch({ l: 0.7, c: 0.15, h: 255 })).toBe("oklch(0.7 0.15 255)");
    expect(formatOklch({ l: 0.7, c: 0.15, h: 255, a: 1 })).toBe("oklch(0.7 0.15 255)");
    expect(oklchToHex({ l: 0.7, c: 0.15, h: 255 })).toMatch(/^#[0-9a-f]{6}$/);
    expect(formatRgb({ l: 0.7, c: 0.15, h: 255 })).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
  });

  test("transparency reaches every format", () => {
    const c = { l: 0.7, c: 0.15, h: 255, a: 0.5 };
    expect(formatOklch(c)).toBe("oklch(0.7 0.15 255 / 0.5)");
    expect(oklchToHex(c)).toMatch(/^#[0-9a-f]{8}$/);
    expect(formatRgb(c)).toBe(`rgb(${oklchToRgb255(c).join(" ")} / 0.5)`);
  });

  test("alpha parses as a fraction or a percentage", () => {
    expect(parseOklch("oklch(0.7 0.15 255 / 0.5)")).toEqual({ l: 0.7, c: 0.15, h: 255, a: 0.5 });
    expect(parseOklch("oklch(0.7 0.15 255 / 50%)")).toEqual({ l: 0.7, c: 0.15, h: 255, a: 0.5 });
    // Fully opaque drops the key, so `a` never appears meaning "opaque".
    expect(parseOklch("oklch(0.7 0.15 255 / 1)")).toEqual({ l: 0.7, c: 0.15, h: 255 });
  });

  test("hex carries alpha in its 4 and 8 digit forms", () => {
    expect(hasAlpha(hexToOklch("#59a0f980") as never)).toBe(true);
    expect(hasAlpha(hexToOklch("#59a0f9") as never)).toBe(false);
    expect(hasAlpha(hexToOklch("#f008") as never)).toBe(true);
  });

  test("alpha survives an oklch to hex to oklch trip", () => {
    const back = hexToOklch(oklchToHex({ l: 0.7, c: 0.15, h: 255, a: 0.5 }));
    expect(alphaOf(back as never)).toBeCloseTo(0.5, 2);
  });

  // Alpha is not a gamut axis. Transparency cannot pull a colour in or out of
  // what a screen can show, so it must not reach the clamping.
  test("alpha does not affect gamut, and survives clamping", () => {
    const wide = { l: 0.75, c: 0.35, h: 145, a: 0.4 };
    expect(inGamut(wide)).toBe(inGamut({ l: 0.75, c: 0.35, h: 145 }));
    const clamped = clampToGamut(wide);
    expect(alphaOf(clamped)).toBe(0.4);
    expect(clamped.c).toBeLessThan(wide.c);
  });
});

describe("rgb", () => {
  test("parses the comma and space forms, and rgba", () => {
    const space = parseRgb("rgb(89 160 249)");
    const comma = parseRgb("rgb(89, 160, 249)");
    expect(space).not.toBeNull();
    expect(formatRgb(space as never)).toBe("rgb(89 160 249)");
    expect(formatRgb(comma as never)).toBe("rgb(89 160 249)");
    expect(alphaOf(parseRgb("rgba(89, 160, 249, 0.5)") as never)).toBe(0.5);
  });

  test("channels survive an rgb round trip", () => {
    for (const rgb of ["rgb(255 0 0)", "rgb(0 128 64)", "rgb(18 52 86)"]) {
      expect(formatRgb(parseRgb(rgb) as never)).toBe(rgb);
    }
  });

  test("rejects what is not an rgb string", () => {
    expect(parseRgb("oklch(0.7 0.15 255)")).toBeNull();
    expect(parseRgb("#ff0000")).toBeNull();
    expect(parseRgb("rgb(1 2)")).toBeNull();
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

  // Regression: these two disagreed near black. maxChroma returned 0 while
  // inGamut still said true, so the picker drew a crosshair above the curve and
  // showed no out-of-gamut notice for a colour it could not display.
  // Every hue, not a sample of six. This test was written for exactly the bug
  // it then missed: rounding inside `inGamut` made membership flicker, the
  // bisection converged in a dead zone, and `maxChroma` reported less than
  // `inGamut` accepted. It failed at h=221 and h=222 alone, and neither was
  // among the six hues it checked.
  test("inGamut and maxChroma agree everywhere, near black included", () => {
    for (let h = 0; h < 360; h++) {
      for (let l = 0; l <= 1.0001; l += 0.02) {
        const limit = maxChroma(l, h);
        // Anything past the reported limit must be reported as out of gamut.
        expect(inGamut({ l, c: limit + 0.01, h }), `h=${h} l=${l.toFixed(2)}`).toBe(false);
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

  // Regression: the clamp landed just inside the boundary and `formatOklch`
  // rounded chroma half up, back out of it. The object was in gamut and the
  // string it formatted to was not, so a picker fed its own emitted value
  // showed the out-of-gamut notice.
  test("a clamped colour survives formatting and parsing back", () => {
    const emitted = formatOklch(clampToGamut({ l: 0, c: 0.425, h: 220 }));
    expect(inGamut(parseOklch(emitted) as Oklch)).toBe(true);
  });

  // Every gamut, because the near-white failure this caught was Rec2020's
  // alone: its in-gamut island there is thinner than the four decimals the
  // string keeps.
  test.each([
    ["sRGB", SRGB],
    ["P3", P3],
    ["Rec2020", REC2020],
  ])("nothing out of gamut is emitted for %s, over a dense sweep", (_name, gamut) => {
    let escaped = 0;
    for (let l = 0; l <= 1.0001; l += 0.05) {
      for (let h = 0; h < 360; h += 15) {
        for (const c of [0.05, 0.15, 0.25, 0.35, 0.5]) {
          const clamped = clampToGamut({ l, c, h }, gamut);
          const parsed = parseOklch(formatOklch(clamped)) as Oklch;
          if (!inGamut(clamped, gamut) || !inGamut(parsed, gamut)) escaped++;
        }
      }
    }
    expect(escaped).toBe(0);
  });

  // The clamp's chroma must not change when it goes through the string, or
  // `resolveCurrent` stops recognising its own draft.
  test("clamping is idempotent through the emitted string", () => {
    for (let l = 0; l <= 1.0001; l += 0.1) {
      for (let h = 0; h < 360; h += 30) {
        const once = formatOklch(clampToGamut({ l, c: 0.5, h }));
        const twice = formatOklch(clampToGamut(parseOklch(once) as Oklch));
        expect(twice).toBe(once);
      }
    }
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

  test("peak chroma depends on lightness, so a fixed slider max is mostly dead", () => {
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
      // early depends on the hue. Green needs more lightness than blue before
      // any chroma survives quantisation, so this only pins the ordering.
      expect(maxChroma(0.08, h)).toBeGreaterThan(0);
      expect(maxChroma(0.08, h)).toBeGreaterThan(maxChroma(0.03, h));
      // And stays narrow. This is near black, not a phantom peak.
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

  // The h chart sweeps lightness horizontally, so it is the one that shows the
  // gamut closing to a point at black and at white.
  test("the lightness silhouette rises to a peak and falls away", () => {
    const cols = gamutCurve({ l: 0.5, c: 0.1, h: 145 }, "h", 64);
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
      const cols = gamutCurve({ l: 0.5, c: 0.1, h }, "h", 64);
      const peak = cols.reduce((a, b) => (b.c > a.c ? b : a));
      expect(peak.t).toBeGreaterThan(0.4);
    }
  });

  test("the l chart's hue sweep varies with hue", () => {
    const cols = gamutCurve({ l: 0.7, c: 0.15, h: 0 }, "l", 32);
    const values = cols.map((c) => c.c);
    expect(Math.max(...values)).toBeGreaterThan(Math.min(...values) + 0.05);
  });

  // The charts scaled to MAX_CHROMA, the bisection bound, which no colour
  // reaches. The top 13% of every chart was permanently empty.
  test("the tallest curve nearly fills the chart, and none overflows", () => {
    let tallest = 0;
    for (let h = 0; h < 360; h += 3) {
      for (const col of gamutCurve({ l: 0, c: 0, h }, "h", 64)) {
        expect(col.c).toBeLessThanOrEqual(1);
        tallest = Math.max(tallest, col.c);
      }
    }
    // Some hue must come close to the top, or the scale is too generous again.
    expect(tallest).toBeGreaterThan(0.9);
  });

  test("the chart scale sits just above the reachable peak", () => {
    let peak = 0;
    for (let h = 0; h < 360; h += 3) {
      for (let l = 0; l <= 1; l += 0.02) peak = Math.max(peak, maxChroma(l, h));
    }
    // Above, so nothing clips; close, so no band of the chart is dead.
    expect(CHART_MAX_CHROMA).toBeGreaterThan(peak);
    expect(CHART_MAX_CHROMA).toBeLessThan(peak * 1.1);
  });

  // The bug this replaced: the c and h charts both swept max chroma against
  // hue, so they drew byte-identical curves under two different sliders.
  test("the three charts are genuinely different slices", () => {
    const base = { l: 0.7, c: 0.15, h: 255 };
    const [l, c, h] = (["l", "c", "h"] as const).map((axis) =>
      gamutCurve(base, axis, 32)
        .map((col) => col.c.toFixed(4))
        .join(),
    );
    expect(l).not.toBe(c);
    expect(c).not.toBe(h);
    expect(l).not.toBe(h);
  });

  // The c chart's vertical axis is lightness, and holding chroma fixed makes
  // some hues unreachable at every lightness. That is a column of zero, not a
  // floor.
  test("the c chart reports zero where the held chroma is unreachable", () => {
    const cols = gamutCurve({ l: 0.7, c: 0.15, h: 255 }, "c", 32);
    expect(cols.some((col) => col.c === 0)).toBe(true);
    expect(cols.some((col) => col.c > 0.5)).toBe(true);
  });
});

describe("colourName", () => {
  test("names by hue", () => {
    expect(colourName("oklch(0.75 0.16 145)")).toBe("Green");
    expect(colourName("oklch(0.7 0.15 255)")).toBe("Blue");
    expect(colourName("oklch(0.76 0.15 60)")).toBe("Amber");
  });

  test("hue alone is not enough, lightness and chroma qualify it", () => {
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

describe("wider gamuts", () => {
  test("each contains the one below it", () => {
    let checked = 0;
    for (let h = 0; h < 360; h += 5) {
      for (let l = 0.1; l <= 0.95; l += 0.05) {
        const c = maxChroma(l, h, SRGB);
        if (c <= 0) continue;
        checked++;
        // Just inside sRGB must also be inside the wider spaces.
        expect(inGamut({ l, c: c * 0.99, h }, P3)).toBe(true);
        expect(inGamut({ l, c: c * 0.99, h }, REC2020)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  test("each reaches further than the one below it", () => {
    const peak = (g: Parameters<typeof maxChroma>[2]) => {
      let p = 0;
      for (let h = 0; h < 360; h += 3) {
        for (let l = 0.05; l <= 0.98; l += 0.02) p = Math.max(p, maxChroma(l, h, g));
      }
      return p;
    };
    const [s, p, r] = [peak(SRGB), peak(P3), peak(REC2020)];
    expect(p).toBeGreaterThan(s);
    expect(r).toBeGreaterThan(p);
  });

  // Each gamut bisects against its own bound: Rec. 2020 reaches ~0.464, so
  // sharing sRGB's 0.37 would have clipped its boundary with no visible error.
  test("no gamut's peak is clipped by its own search bound", () => {
    for (const g of [SRGB, P3, REC2020]) {
      let p = 0;
      for (let h = 0; h < 360; h += 3) {
        for (let l = 0.05; l <= 0.98; l += 0.02) p = Math.max(p, maxChroma(l, h, g));
      }
      expect(p).toBeLessThan(g.maxChroma);
      expect(p).toBeLessThanOrEqual(g.chartMaxChroma);
    }
  });
});

describe("the output gamut", () => {
  // Outside sRGB, comfortably inside P3.
  const wide = { l: 0.7, c: 0.25, h: 145 };

  test("says nothing when the colour is displayable", () => {
    const m = pickerModel({ l: 0.7, c: 0.1, h: 255 });
    expect(m.clipped).toBe(false);
    expect(m.notice).toBe("");
  });

  test("defaults to sRGB, with the wording 1.0 shipped", () => {
    const m = pickerModel(wide);
    expect(m.gamut.id).toBe("srgb");
    expect(m.clipped).toBe(true);
    expect(m.notice).toBe(DEFAULT_LABELS.outOfGamut);
  });

  // The point of choosing a wider space: the colour is emitted, not flagged
  // and thrown away. Warning about a colour the picker itself now outputs
  // would defeat the purpose of enabling it.
  test("a wider gamut emits the colour rather than clamping it away", () => {
    const srgb = pickerModel(wide);
    const p3 = pickerModel(wide, { gamut: P3 });

    expect(p3.clipped).toBe(false);
    expect(p3.notice).toBe("");
    // sRGB clamps the chroma down; P3 keeps what was dialled.
    expect(parseOklch(srgb.canonical)?.c).toBeLessThan(0.23);
    expect(parseOklch(p3.canonical)?.c).toBeCloseTo(0.25, 3);
    // And the chroma slider reaches further.
    expect(p3.reachable).toBeGreaterThan(srgb.reachable);
  });

  test("sRGB stays drawn as a reference when it is not the output", () => {
    expect(pickerModel(wide, { gamut: P3 }).references.map((g) => g.id)).toEqual(["srgb"]);
    // Nothing to outline when sRGB is itself the output.
    expect(pickerModel(wide).references).toEqual([]);
  });

  test("only warns once the colour leaves the output gamut too", () => {
    const m = pickerModel({ l: 0.7, c: 0.6, h: 145 }, { gamut: P3 });
    expect(m.clipped).toBe(true);
    expect(m.notice).toBe("Outside Display P3, the nearest Display P3 colour is used.");
  });

  test("each message can be replaced, per gamut and in general", () => {
    expect(pickerModel(wide, { labels: { outOfGamut: "Nope." } }).notice).toBe("Nope.");
    expect(
      pickerModel({ l: 0.7, c: 0.6, h: 145 }, { gamut: P3, labels: { "outOf:p3": "Too far." } })
        .notice,
    ).toBe("Too far.");
  });

  test("parts.notice turns the message off without changing the maths", () => {
    const m = pickerModel(wide, { parts: { notice: false } });
    expect(m.parts.notice).toBe(false);
    // Still clipped, so the emitted value is still clamped. Only the text goes.
    expect(m.clipped).toBe(true);
  });
});

describe("the gamut switcher", () => {
  const c = { l: 0.7, c: 0.15, h: 255 };

  test("is off unless asked for", () => {
    expect(pickerModel(c).withGamutSwitch).toBe(false);
    expect(pickerModel(c, { gamut: P3 }).withGamutSwitch).toBe(false);
  });

  test("offers the output gamut and its references", () => {
    const m = pickerModel(c, { gamut: P3, parts: { gamutSwitch: true } });
    expect(m.withGamutSwitch).toBe(true);
    expect(m.gamutChoices.map((g) => g.id)).toEqual(["srgb", "p3"]);
  });

  test("stays hidden when there is only one space to choose", () => {
    // sRGB alone has no references, so the control would have one button.
    const m = pickerModel(c, { parts: { gamutSwitch: true } });
    expect(m.withGamutSwitch).toBe(false);
    expect(m.gamutChoices).toEqual([]);
  });

  test("takes an explicit list, deduplicated by id", () => {
    const m = pickerModel(c, {
      gamut: P3,
      gamutChoices: [SRGB, P3, REC2020, P3],
      parts: { gamutSwitch: true },
    });
    expect(m.gamutChoices.map((g) => g.id)).toEqual(["srgb", "p3", "rec2020"]);
  });
});

describe("recent colours", () => {
  test("keeps the most recent first", () => {
    expect(addRecent(["b", "c"], "a")).toEqual(["a", "b", "c"]);
  });

  // Re-picking a colour should move it up, not stack a duplicate: two dials of
  // the same colour are the same colour however they were reached.
  test("moves a repeat to the front rather than duplicating it", () => {
    expect(addRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(addRecent(["a"], "a")).toEqual(["a"]);
  });

  test("drops the oldest past the limit", () => {
    const full = ["1", "2", "3", "4", "5", "6", "7", "8"];
    expect(addRecent(full, "9")).toEqual(["9", "1", "2", "3", "4", "5", "6", "7"]);
    expect(addRecent(full, "9")).toHaveLength(DEFAULT_MAX_RECENTS);
  });

  test("honours a custom limit, and zero disables it", () => {
    expect(addRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
    expect(addRecent(["a", "b"], "c", 0)).toEqual([]);
  });

  test("does not mutate the list it was given", () => {
    const before = ["a", "b"];
    addRecent(before, "c");
    expect(before).toEqual(["a", "b"]);
  });
});

describe("the chart follows the output gamut", () => {
  // Regression: `gamutChartModel` computed the filled curve without a gamut, so
  // it always drew sRGB. Passing P3 added a dotted outline while the plot
  // underneath never moved, which read as the gamut being ignored.
  test("the filled curve differs per output space", () => {
    const srgb = gamutChartModel(chartBase(145, "h"), "h", 32, [], SRGB);
    const p3 = gamutChartModel(chartBase(145, "h"), "h", 32, [], P3);
    expect(p3.path).not.toBe(srgb.path);
  });

  test("a wider gamut reaches further in absolute chroma", () => {
    // The chart renormalises per gamut, so compare the reach it represents
    // rather than the drawn height.
    const at = (g: typeof SRGB) => maxChroma(0.7, 145, g);
    expect(at(P3)).toBeGreaterThan(at(SRGB));
    expect(at(REC2020)).toBeGreaterThan(at(P3));
  });

  // Every curve arrives normalised by its own space's scale, so drawing them
  // together without conversion would put a narrower gamut above a wider one.
  test("a reference outline sits above the filled region, not below it", () => {
    const m = gamutChartModel(chartBase(145, "h"), "h", 32, [P3], SRGB);
    const y = (path: string) => path.split(" L").map((p) => Number(p.split(",")[1]));
    const filled = y(m.path);
    const outline = y(m.boundaries[0]?.path ?? "");
    expect(outline).toHaveLength(filled.length);
    // Lower y is higher on the chart, and P3 reaches past sRGB at this hue.
    const peakFilled = Math.min(...filled);
    const peakOutline = Math.min(...outline);
    expect(peakOutline).toBeLessThan(peakFilled);
  });
});

describe("recents only record reachable colours", () => {
  // Regression: the commit path ran the dialled colour through `emitValue`,
  // which clamps, so releasing a drag in a hatched region filed the nearest
  // reachable colour under one the user never chose.
  test("an out-of-gamut colour records nothing", () => {
    expect(recentValue({ l: 0.7, c: 0.28, h: 145 })).toBeNull();
  });

  test("a reachable colour records its canonical string", () => {
    expect(recentValue({ l: 0.7, c: 0.15, h: 255 })).toBe("oklch(0.7 0.15 255)");
  });

  test("what counts as reachable follows the output gamut", () => {
    // Inside P3, outside sRGB, so it records under P3 and not under sRGB.
    const wide = { l: 0.7, c: 0.26, h: 145 };
    expect(recentValue(wide, SRGB)).toBeNull();
    expect(recentValue(wide, P3)).not.toBeNull();
  });

  test("alpha rides along and does not affect reachability", () => {
    expect(recentValue({ l: 0.7, c: 0.15, h: 255, a: 0.5 })).toBe("oklch(0.7 0.15 255 / 0.5)");
  });
});

describe("chart scale", () => {
  const height = (path: string) =>
    34 - Math.min(...path.split(" L").map((p) => Number(p.split(",")[1])));

  // Regression: each chart normalised to its own gamut's peak, so Rec. 2020
  // was divided by a larger number than P3 and drew *lower* despite reaching
  // further. Height has to mean absolute reach or it means nothing.
  test("on one shared scale, a wider gamut draws taller", () => {
    const refs = [SRGB, P3, REC2020];
    const m = gamutChartModel(chartBase(145, "h"), "h", 64, refs, SRGB);
    const [srgb, p3, rec] = m.boundaries.map((b) => height(b.path));
    expect(p3).toBeGreaterThan(srgb as number);
    expect(rec).toBeGreaterThan(p3 as number);
  });

  test("the scale is the widest space in view, not the output one", () => {
    expect(chartScale("h", SRGB, [])).toBe(SRGB.chartMaxChroma);
    expect(chartScale("h", SRGB, [REC2020])).toBe(REC2020.chartMaxChroma);
    expect(chartScale("h", P3, [SRGB])).toBe(P3.chartMaxChroma);
  });

  // Lightness and hue are shared by every space, so only a chroma axis moves.
  test("a non-chroma vertical axis has one scale for every gamut", () => {
    expect(chartScale("c", SRGB, [REC2020])).toBe(chartScale("c", SRGB, []));
  });

  test("the crosshair sits on the same scale as the curve", () => {
    const current = { l: 0.7, c: 0.2, h: 145 };
    const wide = pickerModel(current, { gamut: SRGB, references: [REC2020] });
    const alone = pickerModel(current, { gamut: SRGB, references: [] });
    // Same colour, but the wider scale puts the crosshair lower in the frame.
    expect(wide.charts[0]?.y).toBeLessThan(alone.charts[0]?.y as number);
  });
});

describe("which reference lines are drawn", () => {
  const ALL = [SRGB, P3, REC2020];

  // A line for the output would trace its own boundary, and a wider one would
  // mark colours the picker cannot reach.
  test("only spaces narrower than the output draw a line", () => {
    const ids = (g: typeof SRGB) =>
      pickerModel({ l: 0.7, c: 0.2, h: 145 }, { gamut: g, references: ALL }).references.map(
        (r) => r.id,
      );
    expect(ids(SRGB)).toEqual([]);
    expect(ids(P3)).toEqual(["srgb"]);
    expect(ids(REC2020)).toEqual(["srgb", "p3"]);
  });

  // Regression: filtering the lines must not filter the switcher, or a picker
  // could never switch up from sRGB.
  test("the switcher still offers wider spaces", () => {
    const m = pickerModel(
      { l: 0.7, c: 0.2, h: 145 },
      { gamut: SRGB, references: ALL, parts: { gamutSwitch: true } },
    );
    expect(m.references).toEqual([]);
    expect(m.gamutChoices.map((g) => g.id)).toEqual(["srgb", "p3", "rec2020"]);
  });

  // A wider space sets the scale even when it draws nothing, so two pickers
  // given the same list stay comparable by height.
  test("a space that draws no line still widens the scale", () => {
    const m = pickerModel({ l: 0.7, c: 0.2, h: 145 }, { gamut: SRGB, references: ALL });
    expect(m.references).toEqual([]);
    expect(chartScale("h", SRGB, m.scaleGamuts)).toBe(REC2020.chartMaxChroma);
  });
});

describe("reference lines carry a label", () => {
  test("each boundary names its space and anchors on its own peak", () => {
    const m = gamutChartModel(chartBase(145, "h"), "h", 32, [SRGB, P3], REC2020);
    expect(m.boundaries.map((b) => b.label)).toEqual([SRGB.label, P3.label]);
    for (const b of m.boundaries) {
      expect(b.labelX).toBeGreaterThanOrEqual(0);
      expect(b.labelY).toBeGreaterThanOrEqual(0);
    }
    // The wider space peaks higher, so its label sits above the other's.
    const [srgb, p3] = m.boundaries;
    expect(p3?.labelY).toBeLessThan(srgb?.labelY as number);
  });

  test("parts.gamutLines removes the lines without moving the scale", () => {
    const opts = { gamut: REC2020, gamutChoices: [SRGB, P3, REC2020] };
    const on = pickerModel({ l: 0.7, c: 0.2, h: 145 }, opts);
    const off = pickerModel({ l: 0.7, c: 0.2, h: 145 }, { ...opts, parts: { gamutLines: false } });
    expect(on.references.map((g) => g.id)).toEqual(["srgb", "p3"]);
    expect(off.references).toEqual([]);
    // Turning the lines off must not resize the chart under the reader.
    expect(chartScale("h", REC2020, off.scaleGamuts)).toBe(
      chartScale("h", REC2020, on.scaleGamuts),
    );
  });

  // Regression: the switcher's choices are spaces in view, so on Rec. 2020 the
  // P3 line belongs too, and the scale must not move as the reader switches.
  test("the switcher's choices count as spaces in view", () => {
    const at = (g: typeof SRGB) =>
      pickerModel({ l: 0.7, c: 0.2, h: 145 }, { gamut: g, gamutChoices: [SRGB, P3, REC2020] });
    expect(at(REC2020).references.map((g) => g.id)).toEqual(["srgb", "p3"]);
    const scales = [SRGB, P3, REC2020].map((g) => chartScale("h", g, at(g).scaleGamuts));
    expect(new Set(scales).size).toBe(1);
  });
});

describe("clicking the chart lands where the pointer is", () => {
  // Regression: `chartPick` converted on sRGB's scale while `chartSlot` read
  // back on the shared one, so the crosshair sat under the pointer at the
  // bottom of the plot and drifted further the higher it went, in proportion
  // to the ratio between the two scales.
  test("the crosshair returns to the y that was clicked", () => {
    const base = { l: 0.84, c: 0.2, h: 145 };
    const references = [SRGB, P3, REC2020];
    for (const y of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const picked = chartPick(base, "h", 0.5, y, SRGB, references);
      const back = pickerModel(picked, { gamut: SRGB, references }).charts[0]?.y;
      expect(back).toBeCloseTo(y, 5);
    }
  });

  test("it round-trips for every output space", () => {
    const references = [SRGB, P3, REC2020];
    for (const gamut of references) {
      const picked = chartPick({ l: 0.7, c: 0.2, h: 145 }, "h", 0.5, 0.8, gamut, references);
      const back = pickerModel(picked, { gamut, references }).charts[0]?.y;
      expect(back).toBeCloseTo(0.8, 5);
    }
  });
});

// Regression: `pickerModel` built these with `filter` and spread, so every call
// returned a new array holding the same spaces. Six of the seven adapters put
// those arrays in the chart's memo, so the identity check missed on every
// render and the curve plus its ~65 gradient stops were rebuilt on every
// pointer move, which is exactly what the memo exists to avoid.
describe("the model's gamut lists keep their identity", () => {
  test.each([
    ["the sRGB default", {}],
    ["a wider output with references", { gamut: P3, references: [SRGB] }],
    ["an explicit set of choices", { gamut: P3, gamutChoices: [SRGB, P3, REC2020] }],
  ])("%s", (_name, options) => {
    const current = { l: 0.7, c: 0.1, h: 200 };
    const a = pickerModel(current, options);
    const b = pickerModel(current, options);
    expect(a.references).toBe(b.references);
    expect(a.scaleGamuts).toBe(b.scaleGamuts);
    expect(a.gamutChoices).toBe(b.gamutChoices);
  });

  // The lists are keyed by their gamuts' ids, so a caller with its own space
  // sharing a built-in id must still get its own objects back rather than ours.
  test("a custom space reusing a built-in id is not swapped for the cached one", () => {
    const mine = { ...P3, label: "Mine" };
    const model = pickerModel({ l: 0.7, c: 0.1, h: 200 }, { gamut: REC2020, references: [mine] });
    expect(model.references[0]).toBe(mine);
  });
});

// Regression: the lightness-vertical plane scans for its ceiling per column, so
// its cost is quadratic in the resolution a caller passes. Every adapter
// exposes that as a prop, and a large one froze the drag in a browser and
// blocked the event loop under SSR.
describe("chart resolution is bounded", () => {
  test("past the cap the curve stops changing", () => {
    const base = { l: 0.7, c: 0.1, h: 200 };
    for (const axis of ["l", "c", "h"] as const) {
      const capped = gamutCurve(base, axis, MAX_CHART_COLUMNS);
      const absurd = gamutCurve(base, axis, MAX_CHART_COLUMNS * 40);
      expect(absurd).toHaveLength(capped.length);
      expect(absurd).toEqual(capped);
    }
  });

  test("a nonsensical resolution still draws a curve", () => {
    const base = { l: 0.7, c: 0.1, h: 200 };
    for (const bad of [0, -10, Number.NaN, 0.4]) {
      const cols = gamutCurve(base, "c", bad);
      expect(cols.length).toBeGreaterThan(0);
      expect(cols.every((c) => Number.isFinite(c.c))).toBe(true);
    }
  });
});

describe("hsl and hwb", () => {
  // Both describe an sRGB colour rather than a space of their own, so each is
  // checked against the hex CSS says it means.
  test.each([
    ["hsl(0 100% 50%)", "#ff0000"],
    ["hsl(120 100% 50%)", "#00ff00"],
    ["hsl(240 100% 50%)", "#0000ff"],
    ["hsl(60 100% 50%)", "#ffff00"],
    ["hsl(180 100% 50%)", "#00ffff"],
    ["hsl(300 100% 50%)", "#ff00ff"],
    ["hsl(0 0% 100%)", "#ffffff"],
    ["hsl(0 0% 0%)", "#000000"],
    ["hsl(0 0% 50%)", "#808080"],
    ["hsl(210 50% 40%)", "#336699"],
  ])("%s is %s", (css, hex) => {
    expect(oklchToHex(parseHsl(css) as Oklch)).toBe(hex);
  });

  test.each([
    ["hwb(0 0% 0%)", "#ff0000"],
    ["hwb(120 0% 0%)", "#00ff00"],
    ["hwb(0 100% 0%)", "#ffffff"],
    ["hwb(0 0% 100%)", "#000000"],
    ["hwb(0 50% 50%)", "#808080"],
    ["hwb(180 20% 20%)", "#33cccc"],
  ])("%s is %s", (css, hex) => {
    expect(oklchToHex(parseHwb(css) as Oklch)).toBe(hex);
  });

  test("an sRGB colour survives a trip through either form", () => {
    for (const hex of [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffffff",
      "#000000",
      "#808080",
      "#336699",
      "#7f3fbf",
      "#123456",
      "#fedcba",
      "#abcdef",
      "#010203",
    ]) {
      const colour = hexToOklch(hex) as Oklch;
      expect(oklchToHex(parseHsl(formatHsl(colour)) as Oklch), `${hex} via hsl`).toBe(hex);
      expect(oklchToHex(parseHwb(formatHwb(colour)) as Oklch), `${hex} via hwb`).toBe(hex);
    }
  });

  test("hue wraps and accepts deg, like every other hue in CSS", () => {
    expect(oklchToHex(parseHsl("hsl(360 100% 50%)") as Oklch)).toBe("#ff0000");
    expect(oklchToHex(parseHsl("hsl(-360 100% 50%)") as Oklch)).toBe("#ff0000");
    expect(oklchToHex(parseHsl("hsl(210deg 50% 40%)") as Oklch)).toBe("#336699");
  });

  // Whiteness and blackness past 100% together is not an error: CSS says the
  // colour is the grey their ratio describes, with no hue left to show.
  test("hwb normalises whiteness and blackness that sum past 100%", () => {
    expect(oklchToHex(parseHwb("hwb(180 60% 60%)") as Oklch)).toBe("#808080");
    expect(oklchToHex(parseHwb("hwb(0 100% 100%)") as Oklch)).toBe("#808080");
    expect(oklchToHex(parseHwb("hwb(90 80% 40%)") as Oklch)).toBe("#aaaaaa");
  });

  test("components out of range clamp rather than fail", () => {
    expect(oklchToHex(parseHsl("hsl(210 150% 40%)") as Oklch)).toBe("#0066cc");
    expect(oklchToHex(parseHsl("hsl(210 -50% 40%)") as Oklch)).toBe("#666666");
    expect(oklchToHex(parseHsl("hsl(210 50% 200%)") as Oklch)).toBe("#ffffff");
    expect(oklchToHex(parseHsl("hsl(210 50% -20%)") as Oklch)).toBe("#000000");
  });

  test("alpha reaches both forms, as a fraction or a percentage", () => {
    expect(alphaOf(parseHsl("hsl(210 50% 40% / 0.5)") as Oklch)).toBe(0.5);
    expect(alphaOf(parseHsl("hsl(210 50% 40% / 50%)") as Oklch)).toBe(0.5);
    expect(alphaOf(parseHwb("hwb(180 20% 20% / 0.5)") as Oklch)).toBe(0.5);
    expect(alphaOf(parseHsl("hsla(210, 50%, 40%, 0.5)") as Oklch)).toBe(0.5);
    // Opaque drops the key, so one shape means opaque everywhere.
    expect(hasAlpha(parseHsl("hsl(210 50% 40% / 1)") as Oklch)).toBe(false);
    expect(formatHsl({ l: 0.7, c: 0.15, h: 255, a: 0.5 })).toMatch(/^hsl\(.+ \/ 0\.5\)$/);
    expect(formatHwb({ l: 0.7, c: 0.15, h: 255, a: 0.5 })).toMatch(/^hwb\(.+ \/ 0\.5\)$/);
  });

  test("rejects what is not that form", () => {
    for (const bad of ["hsl(a b c)", "hsl(210 50%)", "hwb()", "", "rgb(1 2 3)", "nonsense", null]) {
      expect(parseHsl(bad), `hsl accepted ${bad}`).toBeNull();
      expect(parseHwb(bad), `hwb accepted ${bad}`).toBeNull();
    }
  });

  test("toOklch accepts both alongside the forms it already took", () => {
    expect(toOklch("hsl(210 50% 40%)")).not.toBeNull();
    expect(toOklch("hwb(180 20% 20%)")).not.toBeNull();
    expect(oklchToHex(toOklch("hsl(210 50% 40%)") as Oklch)).toBe("#336699");
    expect(oklchToHex(toOklch("hwb(180 20% 20%)") as Oklch)).toBe("#33cccc");
  });

  // Neither form can carry a wide-gamut colour, so both clamp on the way out.
  test("a wider colour is clamped before it is written", () => {
    const wide = { l: 0.75, c: 0.35, h: 145 };
    for (const css of [formatHsl(wide), formatHwb(wide)]) {
      const back = toOklch(css) as Oklch;
      expect(inGamut(back)).toBe(true);
    }
  });
});

// Regression: these three formats are sRGB notations, but each took a `gamut`
// and the picker passed its output space in. A P3 picker's `rgb()` field then
// read `rgb(0 253 63)`, which a browser renders as #00fd3f, while the hex field
// beside it said #01fb48. Two fields, one colour, two answers.
describe("the sRGB formats stay sRGB", () => {
  const wide = { l: 0.86, c: 0.28, h: 145 };

  test("a wide colour is outside sRGB and inside P3, so it is worth testing", () => {
    expect(inGamut(wide, SRGB)).toBe(false);
    expect(inGamut(wide, P3)).toBe(true);
  });

  test("every sRGB format renders as the colour it claims", () => {
    for (const [name, css] of [
      ["rgb", formatRgb(wide)],
      ["hsl", formatHsl(wide)],
      ["hwb", formatHwb(wide)],
      ["hex", oklchToHex(wide)],
    ] as const) {
      const back = toOklch(css) as Oklch;
      expect(back, `${name} did not parse back`).not.toBeNull();
      expect(inGamut(back, SRGB), `${name} wrote a colour sRGB cannot show`).toBe(true);
      // And every one agrees on the colour, since they all describe the same
      // sRGB result.
      expect(oklchToHex(back), `${name} disagrees with hex`).toBe(oklchToHex(wide));
    }
  });

  test("the picker's rgb field agrees with its hex field in a wider space", () => {
    const model = pickerModel(wide, { gamut: P3 });
    expect(oklchToHex(toOklch(model.rgb) as Oklch)).toBe(model.hex);
  });
});

// The contract this suite is really protecting: a colour written in any format
// can be read back, and only `oklch()` survives a wider gamut. Anything else is
// an sRGB notation, so it is clamped and says so in the docs.
describe("every format round-trips, in every gamut", () => {
  const CASES = [
    ["an sRGB colour", { l: 0.75, c: 0.16, h: 145 }],
    ["a P3 colour sRGB cannot show", { l: 0.86, c: 0.28, h: 145 }],
    ["a Rec. 2020 colour P3 cannot show", { l: 0.87, c: 0.34, h: 145 }],
  ] as const;

  test.each(CASES)("%s parses back from every format", (_name, colour) => {
    const nearest = oklchToHex(colour);
    for (const [name, css] of [
      ["oklch", formatOklch(colour)],
      ["rgb", formatRgb(colour)],
      ["hsl", formatHsl(colour)],
      ["hwb", formatHwb(colour)],
      ["hex", oklchToHex(colour)],
    ] as const) {
      const back = toOklch(css) as Oklch;
      expect(back, `${name} did not parse back`).not.toBeNull();
      // Every sRGB notation lands on the same colour: the nearest sRGB one.
      expect(oklchToHex(back), `${name} disagrees`).toBe(nearest);
    }
  });

  test.each(CASES)("%s survives oklch() exactly", (_name, colour) => {
    expect(formatOklch(toOklch(formatOklch(colour)) as Oklch)).toBe(formatOklch(colour));
  });

  // The three wider colours differ from each other in OKLCH and collapse onto
  // sRGB, which is the loss the docs describe. Without this, the test above
  // would pass just as well if every format returned the same thing always.
  test("the wider colours are genuinely outside the narrower spaces", () => {
    const [, srgb] = CASES[0];
    const [, p3] = CASES[1];
    const [, rec] = CASES[2];
    expect(inGamut(srgb, SRGB)).toBe(true);
    expect(inGamut(p3, SRGB)).toBe(false);
    expect(inGamut(p3, P3)).toBe(true);
    expect(inGamut(rec, P3)).toBe(false);
    expect(inGamut(rec, REC2020)).toBe(true);
    // And oklch() keeps them apart where the sRGB formats cannot.
    expect(formatOklch(p3)).not.toBe(formatOklch(rec));
  });
});

// Regression: `chartColour` spread the whole base, so a colour carrying alpha
// produced 8-digit gradient stops while `chartKey` saw the same number either
// way. Nothing hit it, because every adapter routes through `chartBase`, which
// rebuilds `{l, c, h}`. That made the memo correct by accident of a second
// function rather than by the key being complete.
describe("alpha stays out of the chart", () => {
  test("a base carrying alpha draws the same curve as one without", () => {
    const opaque = { l: 0.7, c: 0.15, h: 200 };
    const faded = { ...opaque, a: 0.3 };
    for (const axis of ["l", "c", "h"] as const) {
      const a = gamutChartModel(faded, axis, 16);
      const b = gamutChartModel(opaque, axis, 16);
      expect(a.path, `${axis} path`).toBe(b.path);
      expect(
        a.stops.map((s) => s.hex),
        `${axis} stops`,
      ).toEqual(b.stops.map((s) => s.hex));
    }
  });

  test("no gradient stop carries an alpha pair", () => {
    const stops = gamutChartModel({ l: 0.7, c: 0.15, h: 200, a: 0.3 }, "h", 16).stops;
    for (const s of stops) expect(s.hex, s.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});
