// CodeView: read-only code block with line numbers, wrap, copy and syntax colours (march/ui). Folder: src/components/typography/code-view/.
import "./code-view.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { defineIcon } from "../../../icons/svg.ts";

/** The wrap toggle's icon: lines that turn back under themselves. */
const wrapIcon = defineIcon("wrap-text", ["M3 6h18", "M3 12h15a3 3 0 1 1 0 6h-4", "m16 16-2 2 2 2", "M3 18h7"]);
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { tokenLines, type Token } from "../../../ui/highlight.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface CodeViewProps {
  /** The source code. @tr Kaynak kod. */
  code: MaybeFn<string | null | undefined>;
  /** The language: its label in the toolbar and its colours. @tr Dil: araç çubuğundaki etiketi ve renkleri. */
  lang?: string;
  /** Initial wrap state; the Wrap button toggles it (default false). @tr Başlangıçta satır kaydırma; Wrap düğmesi değiştirir (varsayılan false). */
  wrap?: boolean;
  /** The copy button (default true). @tr Kopyala düğmesi (varsayılan true). */
  copy?: boolean;
  /** Line numbers (default true). @tr Satır numaraları (varsayılan true). */
  lineNumbers?: boolean;
  /** Accessible name of the scroll area (default "Code"). @tr Kaydırma alanının erişilebilir adı (varsayılan "Code"). */
  label?: MaybeFn<string>;
  /** Extra classes on the block. @tr Bloğa eklenen sınıflar. */
  class?: ClassProp;
  /** Colour tokens (default: on when `lang` is known: js/ts/jsx/tsx, css, html, json, sh). @tr Renk belirteçleri (varsayılan: `lang` biliniyorsa açık: js/ts/jsx/tsx, css, html, json, sh). */
  highlight?: boolean;
  /** Extra toolbar controls (widget actions), placed after Wrap. @tr Araç çubuğuna eklenen denetimler (bileşen eylemleri), Wrap'tan sonra yer alır. */
  tools?: unknown;
  /** The whole toolbar (default true); false leaves only the code. @tr Araç çubuğunun tamamı (varsayılan true); false yalnız kodu bırakır. */
  toolbar?: boolean | undefined;
  /** The language label in the toolbar: your own text or node, or false to hide it (default: `lang`). @tr Araç çubuğundaki dil etiketi: kendi metnin ya da düğümün, gizlemek için false (varsayılan: `lang`). */
  langLabel?: unknown;
  /** The Wrap toggle button (default true). @tr Wrap aç / kapa düğmesi (varsayılan true). */
  wrapButton?: boolean | undefined;
  /** Text of the Wrap button (default "Wrap", translated). @tr Wrap düğmesinin metni (varsayılan "Wrap", çevrilir). */
  wrapLabel?: MaybeFn<string | undefined>;
  /** Text of the copy button (default "Copy", translated). @tr Kopyala düğmesinin metni (varsayılan "Copy", çevrilir). */
  copyLabel?: MaybeFn<string> | undefined;
  /** The toolbar's buttons as "text" (default) or "icon": icon buttons whose text is their tooltip and accessible name. @tr Araç çubuğu düğmeleri "text" (varsayılan) ya da "icon": metni ipucu ve erişilebilir adı olan simge düğmeler. */
  buttons?: "text" | "icon" | undefined;
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
        props.wrapButton !== false && (props.buttons === "icon"
          ? h(IconButton, { variant: "ghost", size: "sm", class: "m-code-wrap", icon: wrapIcon, pressed: wrap, label: () => val(props.wrapLabel) ?? t`Wrap`, onClick: () => wrap.update((x) => !x) })
          : h(Button, { variant: "ghost", size: "sm", class: "m-code-wrap", pressed: wrap, onClick: () => wrap.update((x) => !x) }, () => val(props.wrapLabel) ?? t`Wrap`)),
        props.copy !== false && h(CopyButton, { text: () => val(props.code), ...(props.buttons === "icon" ? { iconOnly: true } : {}), ...(props.copyLabel != null ? { label: props.copyLabel } : {}) }), props.tools],
    }),
    h("pre", { class: "m-code-pre", tabindex: "0", "aria-label": () => val(props.label) ?? t`Code` },
      h("code", {}, () => lines().map((line, i) => h("span", { class: "m-code-line" },
        numbers && h("span", { class: "m-code-ln", "aria-hidden": "true" }, String(i + 1)),
        h("span", { class: "m-code-text" }, line.map(([k, x]) => (k ? h("span", { class: `m-tok-${k}` }, x) : x))), "\n")))));
}
