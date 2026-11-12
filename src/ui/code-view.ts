// CodeView and JsonView. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import "./button.css";
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { CopyButton } from "./button.ts";
import { tokenLines, type Token } from "./highlight.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";

export interface CodeViewProps {
  code: MaybeFn<string | null | undefined>; lang?: string; wrap?: boolean; copy?: boolean; lineNumbers?: boolean; label?: MaybeFn<string>; class?: ClassProp;
  /** Colour tokens (default: on when `lang` is known: js/ts/jsx/tsx, css, html, json, sh). */
  highlight?: boolean;
  /** Extra toolbar controls (widget actions), placed after Wrap. */
  tools?: unknown;
}
/** Read-only code block with line numbers: `<CodeView code={src} lang="js" wrap={false} copy />` */
export function CodeView(props: CodeViewProps): Element {
  const wrap = signal(!!props.wrap);
  const lines = (): Token[][] => tokenLines(String(val(props.code) ?? ""), props.highlight === false ? "" : props.lang ?? "");
  const numbers = props.lineNumbers !== false;
  return h("div", { class: () => cx("hm-code", wrap() && "is-wrapped", val(props.class)) },
    h("div", { class: "hm-code-bar" },
      props.lang && h("span", { class: "hm-code-lang" }, props.lang),
      h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", "aria-pressed": () => String(wrap()), onClick: () => wrap.update((x) => !x) }, () => t`Wrap`),
      props.copy !== false && h(CopyButton, { text: () => val(props.code) }), props.tools),
    h("pre", { class: "hm-code-pre", tabindex: "0", "aria-label": () => val(props.label) ?? t`Code` },
      h("code", {}, () => lines().map((line, i) => h("span", { class: "hm-code-line" },
        numbers && h("span", { class: "hm-code-ln", "aria-hidden": "true" }, String(i + 1)),
        h("span", { class: "hm-code-text" }, line.map(([k, x]) => (k ? h("span", { class: `hm-tok-${k}` }, x) : x))), "\n")))));
}

// ------------------------------------------------------------------ JsonView
function jsonNode(key: string | number | null, value: unknown, depth: number, openDepth: number, seen: Set<object>): Element {
  const keyEl = key != null && [h("span", { class: "hm-json-key" }, typeof key === "number" ? String(key) : JSON.stringify(key)), h("span", { class: "hm-json-punct" }, ": ")];
  if (value === null || typeof value !== "object") {
    const type = value === null ? "null" : typeof value;
    const text = type === "string" ? JSON.stringify(value) : type === "undefined" ? "undefined" : type === "bigint" ? `${value as bigint}n` : String(value);
    return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: `hm-json-${type}` }, text));
  }
  if (seen.has(value)) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-null" }, "[circular]"));
  seen.add(value);
  const arr = Array.isArray(value);
  const entries: [string | number, unknown][] | null = arr ? (value as unknown[]).map((v, i) => [i, v]) : value instanceof Date ? null : Object.entries(value);
  if (!entries) return h("li", { class: "hm-json-row" }, keyEl, h("span", { class: "hm-json-string" }, JSON.stringify(value)));
  const open = signal(depth < openDepth);
  const [o, c] = arr ? ["[", "]"] : ["{", "}"];
  const kids = (): Element[] => untrack(() => entries.map(([k, v]) => jsonNode(k, v, depth + 1, openDepth, new Set(seen))));
  return h("li", { class: "hm-json-row" },
    h("button", { type: "button", class: "hm-json-toggle", "aria-expanded": () => String(open()), onClick: () => open.update((x) => !x) },
      keyEl, h("span", { class: "hm-json-punct" }, o),
      () => (open() ? null : h("span", { class: "hm-json-more" }, ` ${entries.length} ${arr ? t`items` : t`keys`} ${c}`))),
    () => open() && [h("ul", { class: "hm-json-list", role: "group" }, kids()), h("span", { class: "hm-json-punct" }, c)]);
}
export interface JsonViewProps { value: MaybeFn<unknown>; /** Initially expanded depth (default 1). */ open?: number; class?: ClassProp }
/** Collapsible read-only JSON tree: `<JsonView value={obj} open={1} />` (open = initially expanded depth). */
export function JsonView(props: JsonViewProps): Element {
  return h("div", { class: () => cx("hm-json", val(props.class)) },
    h("ul", { class: "hm-json-list hm-json-root", role: "tree" }, () => { const v = val(props.value); return untrack(() => jsonNode(null, v, 0, props.open ?? 1, new Set())); }));
}
