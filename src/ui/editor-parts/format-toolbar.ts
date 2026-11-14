// The formatting toolbar MarkdownEditor and RichTextEditor share (src/ui/editor-parts/): one table of
// tools (name, icon, shortcut) and one bar built from Toolbar + IconButton (`pressed`) + Divider, one Tab stop
// (behaviors/roving-focus). Not a public component: the two editors import it by path.
import "./format-toolbar.css";
import { h } from "../../dom/h.ts";
import { t, messages } from "../../core/i18n.ts";
import { cx, val, type MaybeFn } from "../../core/util.ts";
import { glyph } from "../util.ts";
import { isMod } from "../keys.ts";
import { isIconDef, type IconDef } from "../../icons/svg.ts";
import { rovingFocus } from "../../behaviors/roving-focus/index.ts";
import { Toolbar, Divider } from "../stack.ts";
import { IconButton } from "../button.ts";
import { bold } from "../../icons/glyphs/bold.ts";
import { italic } from "../../icons/glyphs/italic.ts";
import { strikethrough } from "../../icons/glyphs/strikethrough.ts";
import { code } from "../../icons/glyphs/code.ts";
import { link } from "../../icons/glyphs/link.ts";
import { list } from "../../icons/glyphs/list.ts";
import { listOrdered } from "../../icons/glyphs/listOrdered.ts";
import { checkCircle } from "../../icons/glyphs/checkCircle.ts";
import { quote } from "../../icons/glyphs/quote.ts";
import { pilcrow } from "../../icons/glyphs/pilcrow.ts";
import { heading } from "../../icons/glyphs/heading.ts";
import { terminal } from "../../icons/glyphs/terminal.ts";
import { undo } from "../../icons/glyphs/undo.ts";
import { redo } from "../../icons/glyphs/redo.ts";
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

export interface FormatToolbarProps<T extends FormatTool = FormatTool> {
  /** Tools in order; "|" draws a separator. */
  tools: readonly (T | "|")[];
  /** Class prefix of the editor ("hm-mde"): the bar is `<prefix>-toolbar`, a button `<prefix>-tool`, a separator `<prefix>-sep`, an own icon `<prefix>-tool-own`. */
  prefix: string;
  /** Accessible name of the toolbar. */
  label: MaybeFn<string>;
  /** Own name of a tool (read live); the translated one otherwise. */
  name?: ((tool: T) => string | undefined) | undefined;
  /** Own icons: an icon, a text or a node each; `false` draws none. */
  icons?: Partial<Record<T, unknown>> | undefined;
  onTool: (tool: T) => void;
  disabled?: ((tool: T) => boolean) | undefined;
  /** Toggle tools: an accessor per tool that can be "on" (sets `aria-pressed` and the pressed look). */
  pressed?: Partial<Record<T, () => boolean>> | undefined;
  /** More shortcuts for `aria-keyshortcuts` (FORMAT_KEYS are there already). */
  keys?: Partial<Record<T, string>> | undefined;
  /** Extra attributes of a tool's button (`aria-haspopup`, `aria-expanded`, `class`, `ref` …). */
  attrs?: ((tool: T) => Record<string, unknown>) | undefined;
}

/** The bar: `<FormatToolbar tools={["bold", "|", "link"]} prefix="hm-mde" label="Formatting" onTool={exec} />`. */
export function FormatToolbar<T extends FormatTool = FormatTool>(props: FormatToolbarProps<T>): Element {
  const p = props.prefix;
  const face = (tool: T): unknown => {
    const own = props.icons?.[tool];
    if (own === false) return null;
    if (own != null && own !== true) return h("span", { class: `hm-format-tool-own ${p}-tool-own`, "aria-hidden": "true" }, isIconDef(own) ? glyph(own) : own);
    return tool === "emoji" ? h("span", { class: "hm-format-tool-emoji", "aria-hidden": "true" }, "☺") : glyph(ICON[tool as Exclude<FormatTool, "emoji">]);
  };
  const bar = h(Toolbar, {
    label: () => val(props.label), class: `hm-format-toolbar ${p}-toolbar`,
    children: props.tools.map((tool) => {
      if (tool === "|") return h(Divider, { vertical: true, class: `hm-format-sep ${p}-sep` });
      const { class: extra, ...attrs } = props.attrs?.(tool) ?? {};
      const on = props.pressed?.[tool];
      return h(IconButton, {
        ...attrs, icon: face(tool), label: () => props.name?.(tool) ?? formatToolName(tool), size: "sm",
        class: () => cx("hm-format-tool", `${p}-tool`, (tool === "h2" || tool === "h3") && `hm-format-tool-${tool}`, val(extra as MaybeFn<string | false | null | undefined>)),
        ...(on ? { pressed: on } : null), "aria-keyshortcuts": props.keys?.[tool] ?? FORMAT_KEYS[tool] ?? null,
        disabled: () => !!props.disabled?.(tool),
        // keep the text selection: the button never takes focus on pointer down
        onMouseDown: (e: MouseEvent) => e.preventDefault(), onClick: () => props.onTool(tool),
      }) as Element;
    }),
  }) as HTMLElement;
  rovingFocus(bar, { orientation: "horizontal", selector: ".hm-format-tool" });
  return bar;
}
