import { ColourPicker } from "@oklch-picker/solid";
import "@oklch-picker/core/styles.css";
import { For, createSignal } from "solid-js";
import { render } from "solid-js/web";
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
  const [colour, setColour] = createSignal("oklch(0.7 0.15 255)");
  const [layout, setLayout] = createSignal("chart");

  return (
    <main class="demo">
      <header class="demo__head">
        <h1 class="demo__title">oklch-picker — Solid</h1>
        <p class="demo__subtitle">
          <code class="demo__code">value</code> and{" "}
          <code class="demo__code">onChange</code>, driving a signal.
        </p>
      </header>

      <div class="demo__layouts">
        <For each={LAYOUTS}>
          {(l) => (
            <button
              type="button"
              class="demo__layout"
              aria-pressed={l === layout()}
              onClick={() => setLayout(l)}
            >
              {l}
            </button>
          )}
        </For>
      </div>

      <div class="demo__panel">
        <ColourPicker
          value={colour()}
          onChange={setColour}
          layout={layout()}
          presets={PRESETS}
        />
      </div>

      <p class="demo__value">
        <span class="demo__swatch" style={{ background: colour() }} />
        <code class="demo__code">{colour()}</code>
      </p>
    </main>
  );
}

render(() => <App />, document.getElementById("root"));
