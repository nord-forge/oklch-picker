/** Side-effect entry: `import "oklch-picker/vanilla/register"` defines the tag.
 *
 * Re-exports the types as well as running the side effect, so that this import
 * alone teaches TypeScript about `<oklch-picker>` and its `change` event. A
 * page that only registers the tag should not also have to import the class
 * to get `event.detail.colour` typed. */
import { register } from "./picker.js";

export type { OklchPickerChangeEvent } from "./picker.js";
export { OklchPickerElement } from "./picker.js";

register();
