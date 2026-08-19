export { ColourPicker } from "./ColourPicker.js";
export type { ColourPickerProps } from "./ColourPicker.js";
export { GamutChart } from "./GamutChart.js";
export type { GamutChartProps } from "./GamutChart.js";
export type { LabelKey, PickerLayout, PickerParts } from "@oklch-picker/core";

// The colour maths is framework-free and useful on its own — for validating
// stored values on a server, generating palettes, or naming colours in a table.
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
} from "@oklch-picker/core";
export type { Axis, Gamut, GamutColumn, Oklch } from "@oklch-picker/core";
