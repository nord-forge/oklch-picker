import { $, component$, useSignal } from "@builder.io/qwik";
import "@oklch-picker/core/styles.css";
import { ColourPicker, type GamutId } from "@oklch-picker/qwik";
import "../../demo.css";

const LAYOUTS = ["chart", "side-by-side", "compact", "stacked"] as const;
const PRESETS = [
  "oklch(0.72 0.19 35)",
  "oklch(0.8 0.17 85)",
  "oklch(0.75 0.16 145)",
  "oklch(0.7 0.15 255)",
  "oklch(0.65 0.22 305)",
];

const GAMUTS: { id: GamutId; label: string }[] = [
  { id: "srgb", label: "sRGB" },
  { id: "p3", label: "Display P3" },
  { id: "rec2020", label: "Rec. 2020" },
];

export const App = component$(() => {
  const colour = useSignal("oklch(0.7 0.15 255)");
  const layout = useSignal<(typeof LAYOUTS)[number]>("chart");
  // Named rather than passed. Qwik serialises props to resume a component, and
  // a Gamut carries `fromLms`, so the id crosses the boundary where the object
  // cannot. The output space is still what decides how a value is clamped.
  const gamut = useSignal<GamutId>("srgb");

  return (
    <main class="demo">
      <header class="demo__head">
        <h1 class="demo__title">oklch-picker for Qwik</h1>
        <p class="demo__subtitle">
          <code class="demo__code">value</code> and{" "}
          <code class="demo__code">onChange$</code>, driving a signal.
        </p>
      </header>

      <div class="demo__layouts">
        {LAYOUTS.map((l) => (
          <button
            key={l}
            type="button"
            class="demo__layout"
            aria-pressed={l === layout.value}
            onClick$={$(() => {
              layout.value = l;
            })}
          >
            {l}
          </button>
        ))}
      </div>

      <div class="demo__panel">
        <ColourPicker
          value={colour.value}
          layout={layout.value}
          presets={PRESETS}
          gamut={gamut.value}
          gamutChoices={GAMUTS.map((g) => g.id)}
          parts={{ gamutSwitch: true }}
          onChange$={$((c: string) => {
            colour.value = c;
          })}
          onGamutChange$={$((g: GamutId) => {
            gamut.value = g;
          })}
        />
      </div>

      <p class="demo__value">
        <span class="demo__swatch" style={{ background: colour.value }} />
        <code class="demo__code">{colour.value}</code>
        <span class="demo__note">
          in {GAMUTS.find((g) => g.id === gamut.value)?.label}
        </span>
      </p>
    </main>
  );
});
