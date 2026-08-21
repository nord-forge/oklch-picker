/** Angular renders the picker on a server, with no DOM in sight.
 *
 * `renderApplication` brings its own document rather than reaching for a
 * global, which is the point: the picker's own code must not touch one. The
 * environment is node, so a stray `document` reference fails here instead of
 * quietly finding a happy-dom global.
 */
import "@angular/compiler";
import { Component, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { renderApplication } from "@angular/platform-server";
import { ColourPickerComponent } from "@oklch-picker/angular";
import { expect, test } from "vitest";

const DOC = "<!doctype html><html><head></head><body><app-host></app-host></body></html>";

/** One host per render. Angular matches the selector against the document it is
 * given, so a shared component would bind to a stale one.
 *
 * `Component({...})(Host)` rather than `@Component`: this vitest project has no
 * transform for decorator syntax, and the decorator is just a function that
 * takes the class. Applying it directly is the same operation without the
 * syntax the project cannot parse. */
function host(props: Record<string, unknown>) {
  class Host {
    readonly value = (props.value as string) ?? "oklch(0.7 0.15 255)";
    readonly parts = props.parts;
    readonly layout = props.layout;
  }
  return Component({
    selector: "app-host",
    standalone: true,
    imports: [ColourPickerComponent],
    template: `
      <oklch-colour-picker [value]="value" [parts]="parts" [layout]="layout" />
    `,
  })(Host);
}

/** The bootstrap context has to reach `bootstrapApplication`, or Angular has no
 * server platform to render on and throws NG0401. */
const render = (props: Record<string, unknown> = {}) =>
  renderApplication((context) => bootstrapApplication(host(props), { providers: [] }, context), {
    document: DOC,
  });

test("there is no DOM to fall back on", () => {
  expect(typeof document).toBe("undefined");
});

test("the server sends real markup, not an empty shell", async () => {
  const out = await render();
  expect(out.match(/type="range"/g)).toHaveLength(4);
  expect(out).toContain("oklch-picker__chart");
  expect(out).toContain("oklch-picker__alpha");
});

test("the value arrives in the markup rather than after hydration", async () => {
  expect(await render()).toContain("oklch(0.7 0.15 255)");
});

test("parts still apply on the server", async () => {
  const out = await render({ parts: { charts: false, alpha: false } });
  expect(out).not.toContain("oklch-picker__chart");
  expect(out.match(/type="range"/g)).toHaveLength(3);
});

test("two renders of the same colour agree", async () => {
  // Not byte-identical: Angular stamps its own ids into the markup, and those
  // are the framework's rather than the picker's. What has to match is every
  // value the picker computed.
  const values = (html: string) => html.match(/value="[^"]*"/g);
  expect(values(await render())).toEqual(values(await render()));
});

// Regression: the uid was a bare module counter, which lives as long as the
// server process rather than as long as a request. Request 1 rendered `a0` and
// request 500 rendered `a500`, while the browser bootstrapping that page
// counted from `a0` again. The uid feeds the SVG gradient id, so the markup
// referenced a gradient the client never built and the chart's fill broke on
// hydration.
test("two server renders agree on their ids", async () => {
  const ids = (markup: string) =>
    [...markup.matchAll(/id="([^"]*-[lch])"/g)].map((m) => m[1]).sort();

  const first = ids(await render());
  const second = ids(await render());

  expect(first.length).toBeGreaterThan(0);
  // Each request starts its own count, so the second render is not offset from
  // the first. A client counting from scratch matches either.
  expect(second).toEqual(first);
});
