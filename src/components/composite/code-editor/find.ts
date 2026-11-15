// The CodeEditor's find bar (Ctrl+F, Ctrl+H) and its "go to line" field (Ctrl+G): a small bar over the code's top
// right corner, as in an IDE. Built from TextInput, IconButton and Button; index.ts keeps the state and does the work.
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx } from "../../../ui/util.ts";
import type { Signal } from "../../../core/reactive.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { arrowDown } from "../../../icons/glyphs/arrowDown.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { chevronDown } from "../../../icons/glyphs/chevronDown.ts";

export type FindMode = "find" | "replace" | "line";
export interface FindState {
  mode: Signal<FindMode | null>;
  text: Signal<string>;
  with: Signal<string>;
  case: Signal<boolean>;
  word: Signal<boolean>;
  regex: Signal<boolean>;
  line: Signal<string>;
}
export interface FindBarOptions {
  state: FindState;
  /** "3/12", "No results" */
  count: () => string;
  next(back: boolean): void;
  replaceOne(): void;
  replaceAll(): void;
  goLine(): void;
  close(): void;
  /** The bar's text field (to focus it). */
  fieldRef(el: HTMLInputElement, which: "find" | "line"): void;
}

export function findBar(o: FindBarOptions): Element {
  const s = o.state;
  const toggle = (sig: Signal<boolean>, label: () => string, glyph: string): unknown => h(IconButton, {
    icon: glyph, size: "xs", label, pressed: () => sig(), class: "m-ced-find-opt", onClick: () => sig.set(!sig.peek()),
  });
  const keys = (e: KeyboardEvent): void => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); o.close(); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase(), sig = k === "c" ? s.case : k === "w" ? s.word : k === "r" ? s.regex : null;
      if (sig) { e.preventDefault(); sig.set(!sig.peek()); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") { e.preventDefault(); s.mode.set(s.mode.peek() === "replace" ? "find" : "replace"); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); (e.target as HTMLInputElement).select(); }
  };
  // the rows stay (the fields keep their focus and text); the mode shows the ones it uses
  const findRow = h("div", { class: "m-ced-find-row", hidden: () => s.mode() === "line" },
    h(IconButton, {
      icon: () => (s.mode() === "replace" ? chevronDown : chevronRight), size: "xs", label: () => t`Replace`, pressed: () => s.mode() === "replace", class: "m-ced-find-more",
      onClick: () => s.mode.set(s.mode.peek() === "replace" ? "find" : "replace"),
    }),
    h(TextInput, {
      class: "m-ced-find-field", value: s.text, placeholder: t`Find`, "aria-label": t`Find`, autocomplete: "off", spellcheck: "false",
      ref: (el: HTMLInputElement) => o.fieldRef(el, "find"),
      onKeyDown: (e: KeyboardEvent) => { keys(e); if (e.key === "Enter") { e.preventDefault(); o.next(e.shiftKey); } else if (e.key === "F3") { e.preventDefault(); o.next(e.shiftKey); } },
    }),
    toggle(s.case, () => t`Match case (Alt+C)`, "Aa"), toggle(s.word, () => t`Whole word (Alt+W)`, "ab"), toggle(s.regex, () => t`Regular expression (Alt+R)`, ".*"),
    h("span", { class: () => cx("m-ced-find-count", s.text() && o.count() === t`No results` && "is-none"), "aria-live": "polite" }, () => (s.text() ? o.count() : "")),
    h(IconButton, { icon: arrowUp, size: "xs", label: () => t`Previous match (Shift+Enter)`, onClick: () => o.next(true) }),
    h(IconButton, { icon: arrowDown, size: "xs", label: () => t`Next match (Enter)`, onClick: () => o.next(false) }),
    h(IconButton, { icon: xIcon, size: "xs", label: () => t`Close (Esc)`, onClick: o.close }));
  const replaceRow = h("div", { class: "m-ced-find-row is-replace", hidden: () => s.mode() !== "replace" },
    h(TextInput, {
      class: "m-ced-find-field", value: s.with, placeholder: t`Replace`, "aria-label": t`Replace with`, autocomplete: "off", spellcheck: "false",
      onKeyDown: (e: KeyboardEvent) => { keys(e); if (e.key === "Enter") { e.preventDefault(); if (e.ctrlKey || e.metaKey) o.replaceAll(); else o.replaceOne(); } },
    }),
    h(Button, { size: "sm", variant: "ghost", onClick: o.replaceOne, title: () => t`Replace (Enter)` }, () => t`Replace`),
    h(Button, { size: "sm", variant: "ghost", onClick: o.replaceAll, title: () => t`Replace all (Ctrl+Enter)` }, () => t`All`));
  const lineRow = h("div", { class: "m-ced-find-row", hidden: () => s.mode() !== "line" },
    h(TextInput, {
      class: "m-ced-find-field", value: s.line, inputmode: "numeric", autocomplete: "off",
      placeholder: t`Line (or line:column)`, "aria-label": t`Go to line`, ref: (el: HTMLInputElement) => o.fieldRef(el, "line"),
      onKeyDown: (e: KeyboardEvent) => { keys(e); if (e.key === "Enter") { e.preventDefault(); o.goLine(); } },
    }),
    h(IconButton, { icon: xIcon, size: "xs", label: () => t`Close (Esc)`, onClick: o.close }));
  return h("div", { class: "m-ced-find", role: "search", "aria-label": () => (s.mode() === "line" ? t`Go to line` : t`Find`) },
    findRow, replaceRow, lineRow) as Element;
}
