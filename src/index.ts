export { ColourPicker } from "./ColourPicker.js";
export type { ColourPickerProps } from "./ColourPicker.js";
export { GamutChart } from "./GamutChart.js";
export type { GamutChartProps } from "./GamutChart.js";

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
} from "./colour.js";
export type { Axis, GamutColumn, Oklch } from "./colour.js";
