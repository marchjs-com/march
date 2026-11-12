// Shared display types: tones, header actions. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import "./button.css";
import { untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { isAction } from "./action.ts";
import { ActionButton } from "./button.ts";
import { val, type MaybeFn } from "./util.ts";

/** Tones of badges, alerts and timeline items. */
export type Tone = "neutral" | "info" | "success" | "warn" | "danger" | (string & {});
/** Actions or nodes shown in a header (Card, Page, Section, Empty): action() objects render as ActionButtons. */
export type ActionsProp = MaybeFn<unknown>;

/** Render a list of actions / nodes (used by Card, Page, Section). */
export function actionsOf(list: ActionsProp, args?: unknown[]): () => unknown[] {
  return () => ([] as unknown[]).concat(val(list) ?? []).map((a) => (isAction(a) ? untrack(() => h(ActionButton, { action: a, args, size: "sm" as const })) : a));
}
