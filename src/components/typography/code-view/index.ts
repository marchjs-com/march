// CodeView: read-only code block with line numbers, wrap, copy and syntax colours (hadi-march/ui). Folder: src/components/typography/code-view/.
import "./code-view.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { tokenLines, type Token } from "../../../ui/highlight.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface CodeViewProps {
  code: MaybeFn<string | null | undefined>; lang?: string; wrap?: boolean; copy?: boolean; lineNumbers?: boolean; label?: MaybeFn<string>; class?: ClassProp;
  /** Colour tokens (default: on when `lang` is known: js/ts/jsx/tsx, css, html, json, sh). */
  highlight?: boolean;
  /** Extra toolbar controls (widget actions), placed after Wrap. */
  tools?: unknown;
  /** The whole toolbar (default true); false leaves only the code. */
  toolbar?: boolean | undefined;
  /** The language label in the toolbar: your own text or node, or false to hide it (default: `lang`). */
  langLabel?: unknown;
  /** The Wrap toggle button (default true). */
  wrapButton?: boolean | undefined;
  /** Text of the Wrap button (default "Wrap", translated). */
  wrapLabel?: MaybeFn<string | undefined>;
  /** Text of the copy button (default "Copy", translated). */
  copyLabel?: MaybeFn<string> | undefined;
}
/** Read-only code block with line numbers: `<CodeView code={src} lang="js" wrap={false} copy />` */
export function CodeView(props: CodeViewProps): Element {
  const wrap = signal(!!props.wrap);
  const lines = (): Token[][] => tokenLines(String(val(props.code) ?? ""), props.highlight === false ? "" : props.lang ?? "");
  const numbers = props.lineNumbers !== false;
  const lang = props.langLabel === false ? null : props.langLabel ?? props.lang;
  return h("div", { class: () => cx("m-code", wrap() && "is-wrapped", val(props.class)) },
    props.toolbar !== false && h(PanelHeader, {
      as: "div", size: "sm", divider: true, class: "m-code-bar",
      lead: lang != null && lang !== "" ? h("span", { class: "m-code-lang" }, lang) : undefined,
      actions: [
        props.wrapButton !== false && h(Button, { variant: "ghost", size: "sm", class: "m-code-wrap", pressed: wrap, onClick: () => wrap.update((x) => !x) }, () => val(props.wrapLabel) ?? t`Wrap`),
        props.copy !== false && h(CopyButton, { text: () => val(props.code), ...(props.copyLabel != null ? { label: props.copyLabel } : {}) }), props.tools],
    }),
    h("pre", { class: "m-code-pre", tabindex: "0", "aria-label": () => val(props.label) ?? t`Code` },
      h("code", {}, () => lines().map((line, i) => h("span", { class: "m-code-line" },
        numbers && h("span", { class: "m-code-ln", "aria-hidden": "true" }, String(i + 1)),
        h("span", { class: "m-code-text" }, line.map(([k, x]) => (k ? h("span", { class: `m-tok-${k}` }, x) : x))), "\n")))));
}
