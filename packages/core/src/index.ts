/**
 * The shared layer every adapter builds on: the colour maths and the headless
 * picker model. Framework-free, no DOM.
 *
 * Most of this is consumed by the adapters rather than by applications, but the
 * colour maths is useful on its own — for validating stored values on a server,
 * generating palettes, or naming colours in a table.
 */
export {
  clampToGamut,
  colourName,
  formatOklch,
  gamutCurve,
  hexToOklch,
  inGamut,
  isLight,
  MAX_CHROMA,
  maxChroma,
  oklchToHex,
  parseOklch,
  toOklch,
} from "./colour.js";
export type { Axis, GamutColumn, Oklch } from "./colour.js";

export {
  atPosition,
  axisModels,
  CHART_H,
  CHART_W,
  chartBase,
  chartKey,
  DEFAULT_LABELS,
  DEFAULT_PARTS,
  emitValue,
  FALLBACK,
  gamutChartModel,
  outOfGamutSpans,
  pickerModel,
  resolveCurrent,
  trackGradient,
} from "./model.js";
export type {
  AxisModel,
  ChartSlot,
  GamutChartModel,
  PickerLayout,
  PickerModel,
  PickerOptions,
  PickerParts,
  Span,
} from "./model.js";
