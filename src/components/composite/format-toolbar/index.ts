// FormatToolbar (hadi-march/ui): the formatting bar of a text editor — bold, italic, headings, lists, link, undo… One
// table of tools (name, icon, shortcut) and one bar built from Toolbar + IconButton (`pressed`) + Divider with a single
// Tab stop (behaviors/roving-focus). MarkdownEditor and RichTextEditor use it; your own editor can too: you choose the
// tools and their order, the names, the icons, the shortcut hints, the colour and the size, and run `onTool`.
import "./format-toolbar.css";
import { effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, glyph, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { isMod, labelWithKey } from "../../../ui/keys.ts";
import { isIconDef, type IconDef } from "../../../icons/svg.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { rovingFocus } from "../../../behaviors/roving-focus/index.ts";
import { Toolbar, Divider } from "../../layout/stack/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { bold } from "../../../icons/glyphs/bold.ts";
import { italic } from "../../../icons/glyphs/italic.ts";
import { strikethrough } from "../../../icons/glyphs/strikethrough.ts";
import { code } from "../../../icons/glyphs/code.ts";
import { link } from "../../../icons/glyphs/link.ts";
import { list } from "../../../icons/glyphs/list.ts";
import { listOrdered } from "../../../icons/glyphs/listOrdered.ts";
import { checkCircle } from "../../../icons/glyphs/checkCircle.ts";
import { quote } from "../../../icons/glyphs/quote.ts";
import { pilcrow } from "../../../icons/glyphs/pilcrow.ts";
import { heading } from "../../../icons/glyphs/heading.ts";
import { terminal } from "../../../icons/glyphs/terminal.ts";
import { undo } from "../../../icons/glyphs/undo.ts";
import { redo } from "../../../icons/glyphs/redo.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** Every formatting tool the editors know. Each editor offers its own subset. */
export type FormatTool = "paragraph" | "h2" | "h3" | "bold" | "italic" | "strike" | "code" | "link" | "emoji" | "ul" | "ol" | "task" | "quote" | "codeblock" | "undo" | "redo";

const NAME: Record<FormatTool, () => string> = {
  paragraph: () => t`Paragraph`, h2: () => t`Heading 2`, h3: () => t`Heading 3`, bold: () => t`Bold`, italic: () => t`Italic`, strike: () => t`Strikethrough`,
  code: () => t`Inline code`, link: () => t`Link`, emoji: () => t`Emoji`, ul: () => t`Bulleted list`, ol: () => t`Numbered list`, task: () => t`Task list`,
  quote: () => t`Quote`, codeblock: () => t`Code block`, undo: () => t`Undo`, redo: () => t`Redo`,
};
/** Translated name of a tool ("Bold"). */
export const formatToolName = (tool: FormatTool): string => NAME[tool]();

const ICON: Record<Exclude<FormatTool, "emoji">, IconDef> = {
  paragraph: pilcrow, h2: heading, h3: heading, bold, italic, strike: strikethrough, code, link, ul: list, ol: listOrdered, task: checkCircle, quote, codeblock: terminal, undo, redo,
};

/** `aria-keyshortcuts` of the shortcuts formatShortcut() reads. */
export const FORMAT_KEYS: Partial<Record<FormatTool, string>> = { bold: "Control+B", italic: "Control+I", strike: "Control+Shift+X", code: "Control+E", link: "Control+K", ol: "Control+Shift+7", ul: "Control+Shift+8", quote: "Control+Shift+9" };
const PLAIN: Record<string, FormatTool> = { b: "bold", i: "italic", e: "code", k: "link" };
const SHIFT: Record<string, FormatTool> = { x: "strike", "7": "ol", "8": "ul", "9": "quote", "&": "ol", "*": "ul", "(": "quote", Digit7: "ol", Digit8: "ul", Digit9: "quote" };
/** The tool of a formatting shortcut: mod+B / I / E / K, mod+Shift+X / 7 / 8 / 9. Undefined for any other key. */
export function formatShortcut(e: KeyboardEvent): FormatTool | undefined {
  if (!isMod(e) || e.altKey) return undefined;
  return e.shiftKey ? SHIFT[e.key.toLowerCase()] ?? SHIFT[e.code] : PLAIN[e.key.toLowerCase()];
}

/** Tools FormatToolbar shows when `tools` is not given, in order. */
export const FORMAT_TOOLS: readonly (FormatTool | "|")[] = ["bold", "italic", "strike", "code", "link", "|", "ul", "ol", "quote", "|", "undo", "redo"];

export interface FormatToolbarProps<T extends FormatTool = FormatTool> {
  /** Tools in order; "|" draws a separator (default FORMAT_TOOLS). Read once: re-create the bar for another list. */
  tools?: readonly (T | "|")[] | undefined;
  /** Runs a tool (your editor applies the format). */
  onTool: (tool: T) => void;
  /** Accessible name of the toolbar (default "Formatting"). */
  label?: MaybeFn<string | undefined>;
  /** Own names: a text per tool (`{ bold: "Strong" }`); the translated one otherwise. */
  labels?: MaybeFn<Partial<Record<T, string>> | undefined>;
  /** Own name of a tool as a function (read live); wins over `labels`. */
  name?: ((tool: T) => string | undefined) | undefined;
  /** Own icons: an icon, a text or a node each; `false` draws none. */
  icons?: Partial<Record<T, unknown>> | undefined;
  disabled?: MaybeFn<boolean | undefined> | ((tool: T) => boolean);
  /** Toggle tools: an accessor per tool that can be "on" (sets `aria-pressed` and the pressed look). */
  pressed?: Partial<Record<T, () => boolean>> | undefined;
  /** Shortcuts for `aria-keyshortcuts` ("Control+B"); FORMAT_KEYS are there already, `false` removes one. */
  keys?: Partial<Record<T, string | false>> | undefined;
  /** The shortcut in the tooltip too: "Bold (Ctrl+B)" (default false: the name alone). */
  hints?: MaybeFn<boolean | undefined>;
  /** Size of the buttons (default "sm"). */
  size?: MaybeFn<"xs" | "sm" | "md" | undefined>;
  /** Theme colour token of the pressed mark (default: the accent, or the editor's colour). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Class prefix of a host that keeps its own class names ("hm-mde"): the bar is also `<prefix>-toolbar`, a button `<prefix>-tool`, a separator `<prefix>-sep`, an own icon `<prefix>-tool-own`. */
  prefix?: string | undefined;
  /** Extra attributes of a tool's button (`aria-haspopup`, `aria-expanded`, `class`, `ref` …). */
  attrs?: ((tool: T) => Record<string, unknown>) | undefined;
  class?: ClassProp;
}

/** `<FormatToolbar tools={["bold", "italic", "|", "link"]} onTool={exec} pressed={{ bold: () => $bold }} hints />` */
export function FormatToolbar<T extends FormatTool = FormatTool>(props: FormatToolbarProps<T>): Element {
  const p = props.prefix;
  const own = (part: string): string | false => !!p && `${p}-${part}`;
  const face = (tool: T): unknown => {
    const mine = props.icons?.[tool];
    if (mine === false) return null;
    if (mine != null && mine !== true) return h("span", { class: cx("hm-format-tool-own", own("tool-own")), "aria-hidden": "true" }, isIconDef(mine) ? glyph(mine) : mine);
    return tool === "emoji" ? h("span", { class: "hm-format-tool-emoji", "aria-hidden": "true" }, "☺") : glyph(ICON[tool as Exclude<FormatTool, "emoji">]);
  };
  const keyOf = (tool: T): string | null => { const k = props.keys?.[tool]; return k === false ? null : k ?? FORMAT_KEYS[tool] ?? null; };
  const nameOf = (tool: T): string => props.name?.(tool) ?? val(props.labels)?.[tool] ?? formatToolName(tool);
  const off = (tool: T): boolean => { const d = props.disabled; return typeof d === "function" ? !!(d as (tool: T) => unknown)(tool) : !!d; };
  const button = (tool: T | "|"): Element => {
    if (tool === "|") return h(Divider, { vertical: true, class: cx("hm-format-sep", own("sep")) }) as Element;
    const { class: extra, ...attrs } = props.attrs?.(tool) ?? {};
    const on = props.pressed?.[tool];
    const key = keyOf(tool);
    return h(IconButton, {
      ...attrs, icon: face(tool), label: () => nameOf(tool), size: () => val(props.size) ?? "sm",
      title: () => (val(props.hints) && key ? labelWithKey(nameOf(tool), key.replace(/Control/g, "mod")) : undefined),
      class: () => cx("hm-format-tool", own("tool"), (tool === "h2" || tool === "h3") && `hm-format-tool-${tool}`, val(extra as MaybeFn<string | false | null | undefined>)),
      ...(on ? { pressed: on } : null), "aria-keyshortcuts": key,
      disabled: () => off(tool),
      // keep the text selection: the button never takes focus on pointer down
      onMouseDown: (e: MouseEvent) => e.preventDefault(), onClick: () => props.onTool(tool),
    }) as Element;
  };
  const bar = h(Toolbar, {
    label: () => val(props.label) ?? t`Formatting`, class: () => cx("hm-format-toolbar", own("toolbar"), val(props.class)),
    children: (props.tools ?? (FORMAT_TOOLS as readonly (T | "|")[])).map(button),
  }) as HTMLElement;
  effect(() => { const c = colorAttr(val(props.color)); if (c) bar.setAttribute("data-hm-color", c); else bar.removeAttribute("data-hm-color"); });
  // by tag: the class of a tool is a binding that may not be written yet
  rovingFocus(bar, { orientation: "horizontal", selector: "button" });
  return bar;
}
