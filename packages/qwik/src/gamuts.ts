/** Gamuts by id, because Qwik cannot serialise the objects themselves.
 *
 * Every other adapter takes `gamut={P3}`. Qwik cannot: a `Gamut` carries
 * `fromLms`, the matrix that defines the colour space, and Qwik serialises
 * props to resume a component on the client. A function in a prop fails with
 * "Value cannot be serialized ... because it's a function".
 *
 * So this adapter takes `gamut="p3"` and resolves the object here, inside the
 * module, where it never crosses a boundary. The id is a string, which
 * serialises fine.
 *
 * The cost is that importing the adapter ships all three colour spaces, where
 * the other adapters ship only what the app imports. That is a few hundred
 * bytes of matrices, and the alternative is an API that fails only once a
 * component actually resumes, which is to say only in production.
 */
import { type Gamut, SRGB } from "@oklch-picker/core";
import { P3, REC2020 } from "@oklch-picker/core/gamuts";

/** What `gamut`, `references` and `gamutChoices` accept. */
export type GamutId = "srgb" | "p3" | "rec2020";

const BY_ID: Record<GamutId, Gamut> = {
  srgb: SRGB,
  p3: P3,
  rec2020: REC2020,
};

/** Resolve an id, falling back to sRGB for anything unrecognised.
 *
 * Unrecognised rather than throwing: the id arrives from a prop that a
 * consumer's TypeScript already narrows, and a colour picker that renders in
 * the wrong space beats one that takes the page down. */
export function gamutFrom(id: GamutId | undefined): Gamut {
  return (id && BY_ID[id]) || SRGB;
}

export function gamutsFrom(ids: GamutId[] | undefined): Gamut[] | undefined {
  return ids?.map(gamutFrom);
}

/** The id for a resolved gamut, for handing one back to the consumer. */
export function idOf(gamut: Gamut): GamutId {
  return (gamut.id as GamutId) in BY_ID ? (gamut.id as GamutId) : "srgb";
}
