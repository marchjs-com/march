// Joined (hadi-march/layout): parts drawn as one piece. Folder: src/components/layout/joined/.
import "./joined.css";
import { h } from "../../../dom/h.ts";
import { rest, val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

/** Corner radius of the whole: a token step (0 square … 4, the theme's radius scale) or "full". */
export type JoinedRadius = 0 | 1 | 2 | 3 | 4 | "full";
export interface JoinedProps {
  /** "vertical" (default: one under the other) or "horizontal" (side by side). */
  direction?: MaybeFn<"vertical" | "horizontal" | undefined>;
  /** Corner radius of the whole (default: the theme's radius, step 2); the parts have none of their own. */
  radius?: MaybeFn<JoinedRadius | undefined>;
  /** The frame around the whole (default true). */
  border?: MaybeFn<boolean | undefined>;
  /** A line between the parts (default true). */
  dividers?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
  children?: unknown;
  /** Other attributes (role, aria-*, data-*) go to the element. */
  [attr: string]: unknown;
}

/**
 * Parts as one piece: `<Joined><Preview /><CodeView … /></Joined>`. Whatever goes in loses its own border, corners,
 * margin and shadow; the whole has one frame and one radius, and a line between the parts. `direction="horizontal"` side by side.
 */
export function Joined(props: JoinedProps): Element {
  return h("div", {
    ...rest(props, ["direction", "radius", "border", "dividers"]),
    class: () => {
      const r = val(props.radius);
      return cx("m-joined", val(props.direction) === "horizontal" && "m-joined-h", r != null && `m-joined-r${r === "full" ? "f" : r}`,
        val(props.border) === false && "m-joined-bare", val(props.dividers) !== false && "m-joined-lines", val(props.class));
    },
  }, props.children);
}
