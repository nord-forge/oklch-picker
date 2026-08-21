/** The build entry.
 *
 * `entry.dev.tsx` is the one the dev server uses. Both render the same `App`.
 */
import { render } from "@builder.io/qwik";
import { App } from "./app";

const root = document.getElementById("root");
if (root) render(root, <App />);
