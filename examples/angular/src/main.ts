// `@angular/compiler` first, so this app's own template compiles at runtime.
// The adapter needs none of it: its templates were compiled by `ngc` when the
// package was built.
import "@angular/compiler";
import { Component, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { SRGB, type Gamut } from "@oklch-picker/core";
import { P3, REC2020 } from "@oklch-picker/core/gamuts";
import { ColourPickerComponent, type PickerLayout } from "@oklch-picker/angular";
import "@oklch-picker/core/styles.css";
import "../../demo.css";

const LAYOUTS: PickerLayout[] = ["chart", "side-by-side", "compact", "stacked"];
const PRESETS = [
  "oklch(0.72 0.19 35)",
  "oklch(0.8 0.17 85)",
  "oklch(0.75 0.16 145)",
  "oklch(0.7 0.15 255)",
  "oklch(0.65 0.22 305)",
];

class App {
  readonly layouts = LAYOUTS;
  readonly presets = PRESETS;
  readonly choices = [SRGB, P3, REC2020];

  readonly colour = signal("oklch(0.7 0.15 255)");
  readonly layout = signal<PickerLayout>("chart");
  // The output space, not a display setting. Picking P3 widens what
  // `valueChange` is allowed to hand back, so the emitted string itself changes.
  readonly gamut = signal<Gamut>(SRGB);
}

// `Component({...})(App)` rather than `@Component`, because this example is
// built by plain Vite with no decorator transform. The decorator is a function
// that takes the class, so applying it directly is the same operation.
const AppComponent = Component({
  selector: "app-root",
  standalone: true,
  imports: [ColourPickerComponent],
  template: `
    <main class="demo">
      <header class="demo__head">
        <h1 class="demo__title">oklch-picker for Angular</h1>
        <p class="demo__subtitle">
          <code class="demo__code">[value]</code> and
          <code class="demo__code">(valueChange)</code>, driving a signal.
        </p>
      </header>

      <div class="demo__layouts">
        @for (l of layouts; track l) {
          <button
            type="button"
            class="demo__layout"
            [attr.aria-pressed]="l === layout()"
            (click)="layout.set(l)"
          >
            {{ l }}
          </button>
        }
      </div>

      <div class="demo__panel">
        <oklch-colour-picker
          [value]="colour()"
          [layout]="layout()"
          [presets]="presets"
          [gamut]="gamut()"
          [gamutChoices]="choices"
          [parts]="{ gamutSwitch: true }"
          (valueChange)="colour.set($event)"
          (gamutChange)="gamut.set($event)"
        />
      </div>

      <p class="demo__value">
        <span class="demo__swatch" [style.background]="colour()"></span>
        <code class="demo__code">{{ colour() }}</code>
        <span class="demo__note">in {{ gamut().label }}</span>
      </p>
    </main>
  `,
})(App);

bootstrapApplication(AppComponent);
