/** The dev-mode entry.
 *
 * `qwikVite` looks for this path when serving, separately from the `client.input`
 * it builds from. Both hand it the same app; this one renders it directly rather
 * than resuming server markup, since in dev there is none.
 */
import { render, type RenderOptions } from "@builder.io/qwik";
import { App } from "./app";

export default function (opts: RenderOptions) {
  const root = document.getElementById("root");
  if (!root) throw new Error("no #root to render into");
  return render(root, <App />, opts);
}
