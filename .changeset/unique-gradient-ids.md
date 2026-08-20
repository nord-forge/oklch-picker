---
"@oklch-picker/react": patch
"@oklch-picker/vue": patch
"@oklch-picker/svelte": patch
"@oklch-picker/solid": patch
"oklch-picker": patch
---

Give each picker its own SVG gradient id

Every chart built its gradient id from the class prefix and the axis, so two
pickers on a page both emitted `oklch-picker-gamut-h`. SVG ids share one
document-wide namespace, so the second picker's `fill="url(#...)"` resolved to
the first one's gradient and its chart drew the wrong colours. Any page with
more than one picker was affected, including the documentation site.

Each adapter now takes a unique id from its framework's own hook: `useId` in
React and Vue, `createUniqueId` in Solid, `$props.id()` in Svelte. Those are
stable across a server render and the hydration that follows, so the fix does
not trade one bug for a hydration mismatch. The custom element uses a module
counter instead, which is safe there because it upgrades in the browser rather
than being rendered to HTML on a server.
