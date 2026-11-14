// The ready completer of CodeEditor for one JSX tag: prop names where a prop may start (after a space, while a name
// is typed, on Ctrl + Space), then the values of a prop inside its quotes.
import type { CodeCompleteContext, CodeCompletion, CodeSuggestion } from "./index.ts";

/** A prop the completer offers. */
export interface JsxProp {
  name: string;
  /** A short note in the list: the type, what it does. */
  hint?: string;
  /** Quoted values (`variant="…"`): offered inside the quotes. */
  values?: readonly string[];
  /** What follows the name when there are no quoted values: `={plus}`, `={false}`; default: nothing (a bare prop). */
  value?: string;
}

/** The most rows the list shows. */
const MAX = 9;

/**
 * `complete` for a `<Tag …>`: `jsxCompleter({ tag: "Button", props: [{ name: "variant", values: ["primary", "ghost"] }, { name: "icon", value: "={plus}" }] })`.
 * `props` may be an accessor (the list can change). Without `tag` any opening tag is completed.
 */
export function jsxCompleter(o: { tag?: string | (() => string); props: readonly JsxProp[] | (() => readonly JsxProp[]) }): (ctx: CodeCompleteContext) => CodeCompletion | null {
  return (ctx) => {
    const tag = typeof o.tag === "function" ? o.tag() : o.tag;
    const m = new RegExp(`<${tag ? tag.replace(/\./g, "\\.") : "[A-Za-z][\\w.]*"}(?![\\w.])([^<>]*)$`).exec(ctx.before);
    if (!m) return null;
    const inside = m[1]!, props = typeof o.props === "function" ? o.props() : o.props;
    // inside the quotes of a prop: its values
    const q = /([A-Za-z][\w:.-]*)="([^"]*)$/.exec(inside);
    if (q) {
      const prop = props.find((p) => p.name === q[1]), word = q[2]!;
      if (!prop?.values) return null;
      const closing = ctx.value[ctx.caret] === '"' ? 1 : 0;
      const items = prop.values.filter((v) => v.startsWith(word) && v !== word).map((v): CodeSuggestion => ({ label: v, insert: `${v}"`, ...(prop.hint ? { hint: prop.hint } : {}) }));
      return { from: ctx.caret - word.length, to: ctx.caret + closing, items };
    }
    // not inside a value (an open quote or brace): a prop name
    const stripped = inside.replace(/"[^"]*"/g, "").replace(/\{[^{}]*\}/g, "");
    if (/["{]/.test(stripped)) return null;
    const k = /(?:^|\s)([A-Za-z][\w:.-]*|)$/.exec(inside);
    if (!k) return null;
    const word = k[1]!;
    if (!word && !ctx.forced && ctx.typed !== " ") return null;
    const used = new Set([...inside.matchAll(/(?:^|\s)([A-Za-z][\w:.-]*)(?==|\s)/g)].map((x) => x[1]));
    const items = props.filter((p) => p.name.startsWith(word) && p.name !== word && !used.has(p.name)).slice(0, MAX).map((p): CodeSuggestion => ({
      label: p.name, ...(p.hint ? { hint: p.hint } : {}),
      // quoted values: the caret goes inside the quotes (and the values are offered); `=""`: inside the quotes too
      ...(p.values?.length ? { insert: `${p.name}=""`, back: 1, again: true } : p.value ? { insert: `${p.name}${p.value}`, ...(p.value === '=""' ? { back: 1 } : {}) } : {}),
    }));
    return { from: ctx.caret - word.length, items };
  };
}
