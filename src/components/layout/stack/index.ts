// Layout primitives: Stack, Toolbar, Divider (hadi-march/layout). Grid has its own folder (../grid).
import "../../../ui/display.css";
import "./stack.css";
import { h } from "../../../dom/h.ts";
import { rest, val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export type Align = "start" | "center" | "end" | "stretch" | "baseline" | "between";
const ALIGN: Record<string, string | undefined> = { start: "start", center: "center", end: "end", stretch: "stretch", baseline: "baseline", between: "between" };
export interface StackProps {
  /** Token step 0–8 (default 3). */
  gap?: number;
  direction?: "row" | "column";
  align?: Align;
  justify?: Align;
  wrap?: boolean;
  as?: string;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Stack gap={3} direction="row" align="center" justify="between" wrap>…</Stack>` (gap = token step 0–8) */
export function Stack(props: StackProps): Element {
  return h(props.as ?? "div", { ...rest(props, ["gap", "direction", "align", "justify", "wrap", "as"]),
    class: () => cx("hm-stack", props.direction === "row" && "hm-stack-row", `hm-gap-${props.gap ?? 3}`, props.wrap && "hm-stack-wrap",
      ALIGN[props.align ?? ""] && `hm-align-${props.align}`, ALIGN[props.justify ?? ""] && `hm-justify-${props.justify}`, val(props.class)) }, props.children);
}
export interface ToolbarProps { label?: MaybeFn<string>; end?: unknown; class?: ClassProp; children?: unknown }
/** Horizontal bar of controls: `<Toolbar label="Filters" end={<Button>…</Button>}>…</Toolbar>` */
export function Toolbar(props: ToolbarProps): Element {
  return h("div", { class: () => cx("hm-toolbar", val(props.class)), role: "toolbar", "aria-label": () => val(props.label) ?? null },
    h("div", { class: "hm-toolbar-start" }, props.children),
    props.end != null && h("div", { class: "hm-toolbar-end" }, props.end));
}
export interface DividerProps { label?: MaybeFn<string>; vertical?: boolean }
/** `<Divider />` or `<Divider label="or" />`; `vertical` for inline separators. */
export function Divider(props: DividerProps = {}): Element {
  if (props.label != null) return h("div", { class: "hm-divider hm-divider-label", role: "separator" }, h("span", {}, () => val(props.label)));
  return h(props.vertical ? "span" : "hr", { class: cx("hm-divider", props.vertical && "hm-divider-v"), role: props.vertical ? "separator" : null, "aria-orientation": props.vertical ? "vertical" : null });
}

// ------------------------------------------------------------------ loaders
