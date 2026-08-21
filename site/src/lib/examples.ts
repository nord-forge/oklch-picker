/**
 * Every example, once, keyed by framework.
 *
 * The guides teach one idea at a time across every framework, which is
 * right for learning but means someone using Vue reads past four other
 * languages on every page. These pages answer the other question: show me all
 * of it, in mine.
 *
 * That is deliberate duplication of what the guides show, so it lives here
 * rather than being copied into five templates. One route renders them all, and
 * a snippet is edited in exactly one place.
 */

export type FrameworkId = "react" | "vue" | "svelte" | "solid" | "angular" | "qwik" | "vanilla";

export interface FrameworkMeta {
  id: FrameworkId;
  /** Shown in the heading and the tab. */
  name: string;
  /** The package someone installs. */
  pkg: string;
  /** How the value is bound, in one phrase, for the intro. */
  binding: string;
  /** Highlighting language for every snippet on the page. */
  lang: "tsx" | "vue" | "svelte" | "html" | "ts";
}

export const FRAMEWORKS: readonly FrameworkMeta[] = [
  {
    id: "react",
    name: "React",
    pkg: "@oklch-picker/react",
    binding: "`value` and `onChange`, the usual controlled pair",
    lang: "tsx",
  },
  {
    id: "vue",
    name: "Vue",
    pkg: "@oklch-picker/vue",
    binding: "`v-model`",
    lang: "vue",
  },
  {
    id: "svelte",
    name: "Svelte",
    pkg: "@oklch-picker/svelte",
    binding: "`bind:value`",
    lang: "svelte",
  },
  {
    id: "solid",
    name: "Solid",
    pkg: "@oklch-picker/solid",
    binding: "`value` and `onChange`, reading the signal at the call site",
    lang: "tsx",
  },
  {
    id: "angular",
    name: "Angular",
    pkg: "@oklch-picker/angular",
    binding: "`[value]` and `(valueChange)`, the usual Angular pair",
    lang: "ts",
  },
  {
    id: "qwik",
    name: "Qwik",
    pkg: "@oklch-picker/qwik",
    binding: "`value` and `onChange$`, the QRL form Qwik uses for every handler",
    lang: "tsx",
  },
  {
    id: "vanilla",
    name: "No framework",
    pkg: "oklch-picker",
    binding: "the `value` attribute and a `change` listener",
    lang: "html",
  },
];

export interface Example {
  title: string;
  /** Why someone would reach for this, in a sentence. */
  blurb: string;
  code: Record<FrameworkId, string>;
}

export const EXAMPLES: readonly Example[] = [
  {
    title: "The basics",
    blurb: "A controlled picker. The value you get back is always canonical and always in gamut.",
    code: {
      react: `import { useState } from "react";
import { ColourPicker } from "@oklch-picker/react";
import "@oklch-picker/core/styles.css";

export function Example() {
  const [colour, setColour] = useState("oklch(0.7 0.15 255)");
  return <ColourPicker value={colour} onChange={setColour} />;
}`,
      vue: `<script setup>
import { ref } from "vue";
import { ColourPicker } from "@oklch-picker/vue";
import "@oklch-picker/core/styles.css";

const colour = ref("oklch(0.7 0.15 255)");
</script>

<template>
  <ColourPicker v-model="colour" />
</template>`,
      svelte: `<script>
  import { ColourPicker } from "@oklch-picker/svelte";
  import "@oklch-picker/core/styles.css";

  let colour = $state("oklch(0.7 0.15 255)");
</script>

<ColourPicker bind:value={colour} />`,
      solid: `import { createSignal } from "solid-js";
import { ColourPicker } from "@oklch-picker/solid";
import "@oklch-picker/core/styles.css";

export function Example() {
  const [colour, setColour] = createSignal("oklch(0.7 0.15 255)");
  return <ColourPicker value={colour()} onChange={setColour} />;
}`,
      qwik: `import { component$, useSignal } from "@builder.io/qwik";
import { ColourPicker } from "@oklch-picker/qwik";
import "@oklch-picker/core/styles.css";

export const Example = component$(() => {
  const colour = useSignal("oklch(0.7 0.15 255)");
  return (
    <ColourPicker
      value={colour.value}
      onChange$={(c) => {
        colour.value = c;
      }}
    />
  );
});`,
      angular: `import { Component, signal } from "@angular/core";
import { ColourPickerComponent } from "@oklch-picker/angular";
import "@oklch-picker/core/styles.css";

@Component({
  selector: "app-example",
  standalone: true,
  imports: [ColourPickerComponent],
  template: \`
    <oklch-colour-picker [value]="colour()" (valueChange)="colour.set($event)" />
  \`,
})
export class ExampleComponent {
  readonly colour = signal("oklch(0.7 0.15 255)");
}`,
      vanilla: `<link rel="stylesheet" href="https://esm.sh/@oklch-picker/core/styles.min.css" />

<oklch-picker id="picker" value="oklch(0.7 0.15 255)"></oklch-picker>

<script type="module">
  import "https://esm.sh/oklch-picker/register";

  document.getElementById("picker").addEventListener("change", (event) => {
    console.log(event.detail.colour); // "oklch(0.7 0.15 120)"
  });
</script>`,
    },
  },
  {
    title: "Presets",
    blurb:
      "Swatches under the sliders. Clicking one commits it, so it joins the recent colours too.",
    code: {
      react: `<ColourPicker
  value={colour}
  onChange={setColour}
  presets={["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]}
/>`,
      vue: '<ColourPicker v-model="colour" :presets="presets" />',
      svelte: "<ColourPicker bind:value={colour} {presets} />",
      solid: "<ColourPicker value={colour()} onChange={setColour} presets={presets} />",
      angular: `<oklch-colour-picker
  [value]="colour()"
  [presets]="['oklch(0.75 0.16 145)', 'oklch(0.7 0.15 255)']"
  (valueChange)="colour.set($event)"
/>`,
      qwik: `<ColourPicker
  value={colour.value}
  presets={["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]}
  onChange$={(c) => (colour.value = c)}
/>`,
      vanilla: `<oklch-picker
  presets='["oklch(0.75 0.16 145)", "oklch(0.7 0.15 255)"]'
></oklch-picker>`,
    },
  },
  {
    title: "A wider gamut",
    blurb:
      "P3 and Rec. 2020 as output spaces, not decoration: the slider reaches further and the value is clamped to the space you chose.",
    code: {
      react: `import { P3 } from "@oklch-picker/core/gamuts";

<ColourPicker value={colour} onChange={setColour} gamut={P3} />`,
      vue: `<script setup>
import { P3 } from "@oklch-picker/core/gamuts";
</script>

<template>
  <ColourPicker v-model="colour" :gamut="P3" />
</template>`,
      svelte: `<script>
  import { P3 } from "@oklch-picker/core/gamuts";
</script>

<ColourPicker bind:value={colour} gamut={P3} />`,
      solid: `import { P3 } from "@oklch-picker/core/gamuts";

<ColourPicker value={colour()} onChange={setColour} gamut={P3} />`,
      angular: `import { P3 } from "@oklch-picker/core/gamuts";

// A gamut is an object, so it is bound as a property.
export class ExampleComponent {
  readonly P3 = P3;
}

// <oklch-colour-picker [value]="colour()" [gamut]="P3" (valueChange)="colour.set($event)" />`,
      qwik: `// An id, not the gamut object. Qwik serialises props to resume a
// component, and a Gamut carries a function, so the id crosses the
// boundary where the object cannot.
<ColourPicker value={colour.value} gamut="p3" onChange$={(c) => (colour.value = c)} />`,
      vanilla: `import { P3 } from "@oklch-picker/core/gamuts";

// A gamut is an object, so it is a property rather than an attribute.
document.querySelector("oklch-picker").gamut = P3;`,
    },
  },
  {
    title: "Letting the user switch space",
    blurb:
      "A segmented control over the output space. Off by default, since most pickers target one.",
    code: {
      react: `const [gamut, setGamut] = useState(SRGB);

<ColourPicker
  value={colour}
  onChange={setColour}
  gamut={gamut}
  onGamutChange={setGamut}
  gamutChoices={[SRGB, P3, REC2020]}
  parts={{ gamutSwitch: true }}
/>`,
      vue: `<ColourPicker
  v-model="colour"
  :gamut="gamut"
  :gamut-choices="[SRGB, P3, REC2020]"
  :parts="{ gamutSwitch: true }"
  @gamut-change="gamut = $event"
/>`,
      svelte: `<ColourPicker
  bind:value={colour}
  {gamut}
  gamutChoices={[SRGB, P3, REC2020]}
  parts={{ gamutSwitch: true }}
  ongamutchange={(next) => (gamut = next)}
/>`,
      solid: `<ColourPicker
  value={colour()}
  onChange={setColour}
  gamut={gamut()}
  onGamutChange={setGamut}
  gamutChoices={[SRGB, P3, REC2020]}
  parts={{ gamutSwitch: true }}
/>`,
      angular: `<oklch-colour-picker
  [value]="colour()"
  [gamut]="gamut()"
  [gamutChoices]="[SRGB, P3, REC2020]"
  [parts]="{ gamutSwitch: true }"
  (valueChange)="colour.set($event)"
  (gamutChange)="gamut.set($event)"
/>`,
      qwik: `<ColourPicker
  value={colour.value}
  gamut={gamut.value}
  gamutChoices={["srgb", "p3", "rec2020"]}
  parts={{ gamutSwitch: true }}
  onChange$={(c) => (colour.value = c)}
  onGamutChange$={(g) => (gamut.value = g)}
/>`,
      vanilla: `const picker = document.querySelector("oklch-picker");
picker.gamutChoices = [SRGB, P3, REC2020];
picker.parts = { gamutSwitch: true };

picker.addEventListener("gamutchange", (event) => {
  picker.gamut = event.detail.gamut;
});`,
    },
  },
  {
    title: "Alpha",
    blurb:
      "On by default. An opaque colour is unchanged in every format, so the alpha forms appear only when a colour is actually transparent.",
    code: {
      react: `// Arrives transparent, comes back transparent.
<ColourPicker value="oklch(0.7 0.15 255 / 0.4)" onChange={setColour} />

// Or drop the slider entirely.
<ColourPicker value={colour} onChange={setColour} parts={{ alpha: false }} />`,
      vue: '<ColourPicker v-model="colour" :parts="{ alpha: false }" />',
      svelte: "<ColourPicker bind:value={colour} parts={{ alpha: false }} />",
      solid: "<ColourPicker value={colour()} onChange={setColour} parts={{ alpha: false }} />",
      angular:
        '<oklch-colour-picker [value]="colour()" [parts]="{ alpha: false }" (valueChange)="colour.set($event)" />',
      qwik: "<ColourPicker value={colour.value} parts={{ alpha: false }} onChange$={(c) => (colour.value = c)} />",
      vanilla: `<oklch-picker
  value="oklch(0.7 0.15 255 / 0.4)"
  parts='{"alpha": false}'
></oklch-picker>`,
    },
  },
  {
    title: "Storing recent colours yourself",
    blurb:
      "The picker keeps a list per session. Pass one in to store them in a backend or share them between pickers.",
    code: {
      react: `const [recents, setRecents] = useState(loadFromServer);

<ColourPicker
  value={colour}
  onChange={setColour}
  recents={recents}
  onRecentsChange={(next) => {
    setRecents(next);
    save(next);
  }}
/>`,
      vue: `<ColourPicker
  v-model="colour"
  :recents="recents"
  @recents-change="onRecentsChange"
/>`,
      svelte: `<ColourPicker
  bind:value={colour}
  {recents}
  onrecentschange={(next) => {
    recents = next;
    save(next);
  }}
/>`,
      solid: `<ColourPicker
  value={colour()}
  onChange={setColour}
  recents={recents()}
  onRecentsChange={setRecents}
/>`,
      angular: `<oklch-colour-picker
  [value]="colour()"
  [recents]="recents()"
  (valueChange)="colour.set($event)"
  (recentsChange)="save($event)"
/>`,
      qwik: `<ColourPicker
  value={colour.value}
  recents={recents.value}
  onChange$={(c) => (colour.value = c)}
  onRecentsChange$={(next) => (recents.value = next)}
/>`,
      vanilla: `const picker = document.querySelector("oklch-picker");
picker.recents = loadFromServer();

picker.addEventListener("recentschange", (event) => {
  save(event.detail.recents);
});`,
    },
  },
  {
    title: "On a server",
    blurb:
      "The markup the server sends is the finished picker, not a shell that fills in on hydration.",
    code: {
      react: `import { renderToString } from "react-dom/server";

renderToString(<ColourPicker value={colour} onChange={setColour} />);`,
      vue: `import { renderToString } from "vue/server-renderer";

await renderToString(createSSRApp({ /* ... */ }));`,
      svelte: `import { render } from "svelte/server";

const { body } = render(ColourPicker, { props: { value: colour } });`,
      solid: `import { renderToString } from "solid-js/web";

renderToString(() => <ColourPicker value={colour()} onChange={setColour} />);`,
      angular: `import { renderApplication } from "@angular/platform-server";

await renderApplication(bootstrap, { document });`,
      qwik: `import { renderToString } from "@builder.io/qwik/server";

// Resumability is the point: the server sends the finished picker and the
// client resumes it rather than re-running the component.
await renderToString(<Example />);`,
      vanilla: `<!-- The element upgrades in the browser, so render the tag on the
     server and import the module from a client-only block. -->
<oklch-picker value="oklch(0.7 0.15 255)"></oklch-picker>

<script type="module">
  import "oklch-picker/register";
</script>`,
    },
  },
];
