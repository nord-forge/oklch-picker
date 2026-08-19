/**
 * The shared layer every adapter builds on: the colour maths and the headless
 * picker model. Framework-free, no DOM.
 *
 * Most of this is consumed by the adapters rather than by applications, but the
 * colour maths is useful on its own — for validating stored values on a server,
 * generating palettes, or naming colours in a table.
 */
export {
  axisMax,
  CHART_PLANES,
  chartColour,
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
  chartAxes,
  chartBase,
  chartKey,
  chartPick,
  chartSlot,
  DEFAULT_LABELS,
  DEFAULT_LAYOUT,
  DEFAULT_PARTS,
  emitValue,
  FALLBACK,
  gamutChartModel,
  outOfGamutSpans,
  pickerModel,
  resolveCurrent,
  trackGradient,
  withSingleChart,
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
