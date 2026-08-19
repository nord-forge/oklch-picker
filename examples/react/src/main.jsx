import { SRGB } from "@oklch-picker/core";
import { P3, REC2020 } from "@oklch-picker/core/gamuts";
import { ColourPicker } from "@oklch-picker/react";
import "@oklch-picker/core/styles.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../demo.css";

const LAYOUTS = ["chart", "side-by-side", "compact", "stacked"];
const PRESETS = [
  "oklch(0.72 0.19 35)",
  "oklch(0.8 0.17 85)",
  "oklch(0.75 0.16 145)",
  "oklch(0.7 0.15 255)",
  "oklch(0.65 0.22 305)",
];

function App() {
  // The picker is controlled: it never holds the colour, it only reports one.
  const [colour, setColour] = useState("oklch(0.7 0.15 255)");
  const [layout, setLayout] = useState("chart");
  // The output space, not a display setting: picking P3 widens what `onChange`
  // is allowed to hand back, so the emitted string itself changes.
  const [gamut, setGamut] = useState(SRGB);

  return (
    <main className="demo">
      <header className="demo__head">
        <h1 className="demo__title">oklch-picker — React</h1>
        <p className="demo__subtitle">
          <code className="demo__code">value</code> and{" "}
          <code className="demo__code">onChange</code>, the usual controlled pair.
        </p>
      </header>

      <div className="demo__layouts">
        {LAYOUTS.map((l) => (
          <button
            key={l}
            type="button"
            className="demo__layout"
            aria-pressed={l === layout}
            onClick={() => setLayout(l)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="demo__panel">
        <ColourPicker
          value={colour}
          onChange={setColour}
          layout={layout}
          presets={PRESETS}
          gamut={gamut}
          onGamutChange={setGamut}
          gamutChoices={[SRGB, P3, REC2020]}
          parts={{ gamutSwitch: true }}
        />
      </div>

      <p className="demo__value">
        <span className="demo__swatch" style={{ background: colour }} />
        <code className="demo__code">{colour}</code>
        <span className="demo__note">in {gamut.label}</span>
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
