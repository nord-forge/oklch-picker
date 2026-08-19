/**
 * The props table, read from the React adapter's built declarations.
 *
 * Hand-maintaining this table means it drifts the first time a prop changes and
 * nobody remembers the docs. Reading `dist/index.d.mts` means the reference
 * cannot disagree with the types, and if the shape it expects ever stops
 * matching, `assertProps` throws the build rather than quietly rendering an
 * empty table.
 *
 * The React adapter is the source because its props are the full set; the core
 * `PickerOptions` omits `value`/`onChange`, which every adapter adds. Names are
 * per-framework (`v-model`, `bind:value`), so the page annotates the
 * differences rather than this parser trying to model five idioms.
 *
 * Note the `$1` suffixes in the declarations: the bundler renames imported
 * types to avoid collisions, so `Gamut$1` is `Gamut`. They are stripped here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface PropDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// Resolved from the process cwd (the `site/` workspace) rather than
// `import.meta.url`: this module is bundled before it runs, so its own URL is
// the build chunk's location, not `src/lib/`, and a path relative to it lands
// somewhere that does not exist.
const DECLARATIONS = resolve(process.cwd(), "../packages/react/dist/index.d.mts");

/** Defaults are documented prose, not part of the type, so they live here. */
const DEFAULTS: Record<string, string> = {
  layout: '"chart"',
  maxRecents: "8",
  parts: "all on except gamutSwitch",
  gamut: "SRGB",
  references: "[SRGB] when gamut is wider",
  gamutChoices: "gamut + references",
  classPrefix: '"oklch-picker"',
  labels: "English",
};

export function readProps(): PropDoc[] {
  let source: string;
  try {
    source = readFileSync(DECLARATIONS, "utf8");
  } catch {
    throw new Error(
      `Could not read ${DECLARATIONS}. The site reads the packages' dist, not their source. Run \`npm run build\` at the repo root first.`,
    );
  }

  const start = source.indexOf("interface ColourPickerProps {");
  if (start === -1) {
    throw new Error(
      "Could not find ColourPickerProps in @oklch-picker/react's declarations. Run `npm run build` first: the site reads dist, not src.",
    );
  }

  // Balance braces rather than matching to the first `}`: nested object types
  // in a prop would end the block early.
  let depth = 0;
  let end = start;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const body = source.slice(source.indexOf("{", start) + 1, end);
  const props: PropDoc[] = [];

  // Each entry is an optional doc comment followed by `name?: type;`.
  const entry = /(?:\/\*\*([\s\S]*?)\*\/\s*)?^\s{2}(\w+)(\??):\s*([^;]+);/gm;

  for (const match of body.matchAll(entry)) {
    const [, comment, name, optional, type] = match;
    if (!name || !type) continue;

    props.push({
      name,
      type: type.replaceAll("$1", "").replace(/\s+/g, " ").trim(),
      required: optional !== "?",
      description: (comment ?? "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*/, "").trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    });
  }

  return props;
}

export function defaultFor(name: string): string {
  return DEFAULTS[name] ?? "-";
}

/**
 * Fail the build if the parse produced something implausible. A silently empty
 * or half-read table is worse than no table: it looks authoritative.
 */
export function assertProps(props: PropDoc[]): PropDoc[] {
  const required = ["value", "onChange", "layout", "parts", "gamut"];
  const missing = required.filter((name) => !props.some((p) => p.name === name));

  if (props.length < 10 || missing.length > 0) {
    const absent = missing.length ? `, missing: ${missing.join(", ")}` : "";
    throw new Error(
      `Parsed only ${props.length} props from the React declarations${absent}. The declaration shape changed. Update site/src/lib/props.ts.`,
    );
  }

  return props;
}
