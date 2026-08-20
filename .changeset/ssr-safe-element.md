---
"oklch-picker": patch
---

Let the custom element be imported on a server

`class OklchPickerElement extends HTMLElement` evaluates at import time, so
importing `oklch-picker` or `oklch-picker/register` in Node threw
`HTMLElement is not defined` before any code ran. Any JavaScript SSR that
imported it outside a client-only block crashed the render.

The class now extends an empty base where there is no DOM. The server-side
class is inert and nobody can construct it, which is correct: there is nothing
to upgrade, and `register()` already returned early without `customElements`.

Template languages were never affected. Rails, Laravel, Django and PHP serve
the tag as text and never import the module. This was Astro, Next, Nuxt and
SvelteKit, and the docs site only escaped it because its imports happen to sit
in client-only script blocks.

A `ssr` test project now renders in a real Node environment with no DOM
globals, so this cannot regress silently.
