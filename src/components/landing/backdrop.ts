// The decorative backdrop of a landing block (Hero, CtaBand): a stack of Overlay effects written as a short recipe
// instead of one `h(Overlay, …)` per layer. One place builds the layers; each block keeps only its recipes (data).
//   backdrop(["mesh", ["grid", 0.35], "spotlight", ["noise", 0.5]])
import { h } from "../../dom/h.ts";
import { Overlay, type OverlayEffect } from "../media/overlay/index.ts";

/** One layer: an effect, `[effect, opacity]`, `[effect, opacity, class]`, or a ready node (an Aurora, a picture). */
export type BackdropLayer = OverlayEffect | readonly [effect: OverlayEffect, opacity?: number | undefined, cls?: string | undefined] | Node;

/** The Overlay layers of a recipe, lowest first; `false` / undefined: no layers (`backdrop={false}` of a block). */
export function backdrop(recipe: readonly BackdropLayer[] | false | null | undefined): unknown[] {
  if (!recipe) return [];
  return recipe.map((layer) => {
    if (typeof layer === "string") return h(Overlay, { effect: layer });
    if (!Array.isArray(layer)) return layer;
    const [effect, opacity, cls] = layer as readonly [OverlayEffect, number?, string?];
    return h(Overlay, { effect, ...(opacity != null ? { opacity } : null), ...(cls ? { class: cls } : null) });
  });
}
