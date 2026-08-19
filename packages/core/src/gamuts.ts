/**
 * Wider gamuts than sRGB, as plain data.
 *
 * These live outside `colour.ts` so they cost nothing unless imported: an app
 * that never mentions P3 never ships these matrices, because the bundler drops
 * an unreferenced module statically. No dynamic import is involved, so
 * `pickerModel` stays pure and synchronous.
 *
 * Each is OKLab's LMS cubes straight to that space's linear channels, folding
 * the OKLab -> XYZ -> RGB pair into one matrix so a membership test is three
 * dot products rather than six.
 */
import type { Gamut } from "./colour.js";

/** Display P3 — the DCI-P3 primaries on a D65 white point, which is what a
 * modern phone or laptop screen actually shows. Roughly 25% wider than sRGB,
 * most visibly in reds and greens. */
export const P3: Gamut = {
  id: "p3",
  label: "Display P3",
  fromLms: ([l_, m_, s_]) => [
    3.1277689713 * l_ - 2.2571357707 * m_ + 0.1293666993 * s_,
    -1.0910090184 * l_ + 2.4133317387 * m_ - 0.3223227203 * s_,
    -0.0260108019 * l_ - 0.5080413317 * m_ + 1.5340521335 * s_,
  ],
  // Peak ~0.363 at l=0.85, h=146.
  maxChroma: 0.42,
  chartMaxChroma: 0.37,
};

/** Rec. 2020 — the UHD broadcast primaries, wider still than P3. Very few
 * screens cover it fully, so treat its boundary as aspirational rather than a
 * promise about what the viewer will see. */
export const REC2020: Gamut = {
  id: "rec2020",
  label: "Rec. 2020",
  fromLms: ([l_, m_, s_]) => [
    2.1401307884 * l_ - 1.2469141323 * m_ + 0.1067833439 * s_,
    -0.8846105941 * l_ + 2.1633265207 * m_ - 0.2787159266 * s_,
    -0.0485265653 * l_ - 0.4547300538 * m_ + 1.5032566191 * s_,
  ],
  // Peak ~0.464 at l=0.83, h=153 — far past what sRGB needs, so a shared
  // bound would have clipped this boundary without any visible error.
  maxChroma: 0.52,
  chartMaxChroma: 0.47,
};
