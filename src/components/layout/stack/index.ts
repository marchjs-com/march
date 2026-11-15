// Layout primitives: Stack, Toolbar, Divider (hadi-march/layout). Grid has its own folder (../grid).
import "../../../ui/display.css";
import "./stack.css";
import { h } from "../../../dom/h.ts";
import { rest, val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export type Align = "start" | "center" | "end" | "stretch" | "baseline" | "between";
const ALIGN: Record<string, string | undefined> = { start: "start", center: "center", end: "end", stretch: "stretch", baseline: "baseline", between: "between" };
export interface StackProps {
  /** Token step 0–8 (default 3). @tr Belirteç adımı 0–8 (varsayılan 3). */
  gap?: number;
  /** "column" (default: one under the other) or "row" (side by side). @tr "column" (varsayılan: alt alta) ya da "row" (yan yana). */
  direction?: "row" | "column";
  /** Cross-axis alignment: start, center, end, stretch, baseline or between. @tr Çapraz eksende hizalama: start, center, end, stretch, baseline ya da between. */
  align?: Align;
  /** Main-axis alignment: start, center, end, stretch, baseline or between. @tr Ana eksende hizalama: start, center, end, stretch, baseline ya da between. */
  justify?: Align;
  /** Items wrap onto new lines. @tr Öğeler yeni satırlara kayar. */
  wrap?: boolean;
  /** Root element tag (default "div"). @tr Kök öğenin etiketi (varsayılan "div"). */
  as?: string;
  /** Extra class on the root (`.m-stack`). @tr Köke (`.m-stack`) eklenen sınıf. */
  class?: ClassProp;
  /** The stacked items. @tr Dizilen öğeler. */
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Stack gap={3} direction="row" align="center" justify="between" wrap>…</Stack>` (gap = token step 0–8) */
export function Stack(props: StackProps): Element {
  return h(props.as ?? "div", { ...rest(props, ["gap", "direction", "align", "justify", "wrap", "as"]),
    class: () => cx("m-stack", props.direction === "row" && "m-stack-row", `m-gap-${props.gap ?? 3}`, props.wrap && "m-stack-wrap",
      ALIGN[props.align ?? ""] && `m-align-${props.align}`, ALIGN[props.justify ?? ""] && `m-justify-${props.justify}`, val(props.class)) }, props.children);
}
export interface ToolbarProps {
  /** Accessible name of the toolbar. @tr Araç çubuğunun erişilebilir adı. */
  label?: MaybeFn<string>;
  /** Controls at the end side. @tr Son taraftaki denetimler. */
  end?: unknown;
  /** Extra class on the root (`.m-toolbar`). @tr Köke (`.m-toolbar`) eklenen sınıf. */
  class?: ClassProp;
  /** Controls at the start side. @tr Baş taraftaki denetimler. */
  children?: unknown;
}
/** Horizontal bar of controls: `<Toolbar label="Filters" end={<Button>…</Button>}>…</Toolbar>` */
export function Toolbar(props: ToolbarProps): Element {
  return h("div", { class: () => cx("m-toolbar", val(props.class)), role: "toolbar", "aria-label": () => val(props.label) ?? null },
    h("div", { class: "m-toolbar-start" }, props.children),
    props.end != null && h("div", { class: "m-toolbar-end" }, props.end));
}
export interface DividerProps {
  /** Text in the middle of the line ("or"). @tr Çizginin ortasındaki metin ("ya da"). */
  label?: MaybeFn<string>;
  /** A vertical line between inline items. @tr Satır içi öğeler arasında dikey bir çizgi. */
  vertical?: boolean;
  /** Extra class on the line. @tr Çizgiye eklenen sınıf. */
  class?: ClassProp;
}
/** `<Divider />` or `<Divider label="or" />`; `vertical` for inline separators. */
export function Divider(props: DividerProps = {}): Element {
  if (props.label != null) return h("div", { class: () => cx("m-divider m-divider-label", val(props.class)), role: "separator" }, h("span", {}, () => val(props.label)));
  return h(props.vertical ? "span" : "hr", { class: () => cx("m-divider", props.vertical && "m-divider-v", val(props.class)), role: props.vertical ? "separator" : null, "aria-orientation": props.vertical ? "vertical" : null });
}

// ------------------------------------------------------------------ loaders
