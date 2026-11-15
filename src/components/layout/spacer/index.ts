// Spacer (march/ui): its own module so a top bar does not pull in the rest of app.ts (menus, dialogs).
import "./spacer.css";
import { h } from "../../../dom/h.ts";

/** Flexible gap in a row (pushes the following items to the end). */
export function Spacer(_props: Record<string, never> = {}): Element {
  return h("span", { class: "m-spacer", "aria-hidden": "true" });
}
