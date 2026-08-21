/**
 * The shared layer every adapter builds on: the colour maths and the headless
 * picker model. Framework-free, no DOM.
 *
 * Most of this is consumed by the adapters rather than by applications, but the
 * colour maths is useful on its own. It can validate stored values on a
 * server, generate palettes, or name colours in a table.
 */
export {
  alphaOf,
  axisMax,
  CHART_MAX_CHROMA,
  SRGB,
  CHART_PLANES,
  chartColour,
  clampToGamut,
  colourName,
  formatOklch,
  formatRgb,
  gamutCurve,
  hasAlpha,
  hexToOklch,
  inGamut,
  isLight,
  MAX_CHROMA,
  maxChroma,
  oklchToHex,
  oklchToRgb255,
  parseOklch,
  parseRgb,
  toOklch,
} from "./colour.js";
export type { Axis, Gamut, GamutColumn, Oklch } from "./colour.js";

export {
  addRecent,
  atPosition,
  axisModels,
  CHART_H,
  CHART_W,
  chartAxes,
  chartBase,
  chartKey,
  chartPick,
  chartScale,
  chartSlot,
  defaultOutOfGamutNotice,
  gamutNoticeKey,
  gamutsKey,
  DEFAULT_LABELS,
  DEFAULT_LAYOUT,
  DEFAULT_MAX_RECENTS,
  DEFAULT_PARTS,
  emitValue,
  FALLBACK,
  gamutChartModel,
  labelTransform,
  outOfGamutSpans,
  pickerModel,
  recentValue,
  resolveCurrent,
  trackGradient,
  withSingleChart,
} from "./model.js";
export type {
  AxisModel,
  ChartSlot,
  GamutChartModel,
  LabelKey,
  PickerLayout,
  PickerModel,
  PickerOptions,
  PickerParts,
  Span,
} from "./model.js";
