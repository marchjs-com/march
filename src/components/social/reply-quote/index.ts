// ReplyQuote (march/social): the small box that shows which message is being answered — who said it and a cut of
// what was said, behind a coloured bar. Inside a message bubble it is the quote over the answer; above a message field
// it is the "replying to" preview with a cancel button. The lines kept, the colour, the bar, the cancel button and
// every text are yours.
import "./reply-quote.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { ClampText } from "../../typography/clamp-text/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import tr from "./tr.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", tr);

export interface ReplyQuoteProps {
  /** The first line: who is quoted ("Deniz"), or your own line ("Replying to Deniz"). @tr İlk satır: alıntılanan kişi ("Deniz") ya da kendi satırınız ("Deniz'e yanıt"). */
  name?: MaybeFn<unknown>;
  /** The quoted text. @tr Alıntılanan metin. */
  text?: MaybeFn<unknown>;
  /** Lines of the text kept (default 2; 1 for a preview above a field; 0 shows all). @tr Metinden tutulan satır sayısı (varsayılan 2; alan üstündeki önizleme için 1; 0 hepsini gösterir). */
  lines?: MaybeFn<number | undefined>;
  /** "soft" (default: a tinted box) or "inverse" (inside a coloured bubble: darker box, bar and name in the text colour). @tr "soft" (varsayılan: renkli bir kutu) ya da "inverse" (renkli bir balonun içinde: daha koyu kutu, çubuk ve ad metin renginde). */
  variant?: MaybeFn<"soft" | "inverse" | undefined>;
  /** The bar at the start edge (default true). @tr Baş kenardaki çubuk (varsayılan true). */
  bar?: MaybeFn<boolean | undefined>;
  /** Shows the cancel button and runs on it. @tr Vazgeç düğmesini gösterir ve ona basılınca çağrılır. */
  onClose?: Handler<[]> | undefined;
  /** The cancel button: shown when `onClose` is given (default), false for none, or your own icon for it. @tr Vazgeç düğmesi: `onClose` verilince gösterilir (varsayılan), false ile hiç, ya da onun için kendi ikonunuz. */
  close?: boolean | unknown | undefined;
  /** Accessible name of the cancel button (default "Cancel reply"). @tr Vazgeç düğmesinin erişilebilir adı (varsayılan "Yanıtı iptal et"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** After the text, before the cancel button: a thumbnail of a quoted photo, your own control. @tr Metinden sonra, vazgeç düğmesinden önce: alıntılanan fotoğrafın küçük resmi, kendi denetiminiz. */
  trail?: unknown;
  /** Makes the quote a button (jump to the quoted message). @tr Alıntıyı bir düğme yapar (alıntılanan mesaja gitmek için). */
  onClick?: Handler<[e: MouseEvent]> | undefined;
  /** Extra class on the box. @tr Kutuya eklenen sınıf. */
  class?: ClassProp;
  /** Other attributes (`id`, `data-*`, `ref`, `aria-*`) go to the box. */
  [attr: string]: unknown;
}

/** `<ReplyQuote name="Deniz" text="See you at 8?" />`, `<ReplyQuote name="Replying to Deniz" text={m.text} lines={1} onClose={cancel} />` */
export function ReplyQuote(props: ReplyQuoteProps): Element {
  const body = [
    props.name != null ? h("b", { class: "m-reply-quote-name" }, () => val(props.name)) : null,
    props.text != null ? h(ClampText, { class: "m-reply-quote-text", as: "span", expandable: false, lines: () => val(props.lines) ?? 2, text: () => val(props.text) }) : null,
  ];
  const showClose = props.close !== false && props.onClose != null;
  const main = props.onClick
    ? h("button", { type: "button", class: "m-reply-quote-main", onClick: props.onClick }, body)
    : h("span", { class: "m-reply-quote-main" }, body);
  return h("div", {
    ...rest(props, ["name", "text", "lines", "variant", "color", "bar", "onClose", "close", "closeLabel", "trail", "onClick"]),
    class: () => cx("m-reply-quote", val(props.variant) === "inverse" && "m-reply-quote-inverse", val(props.bar) === false && "is-barless", val(props.class)),
    // brand orange unless m:color gives another (the common prop is applied after, on this root)
    "data-m-color": "brand-orange",
  },
  main,
  props.trail ?? null,
  showClose ? h(IconButton, {
    class: "m-reply-quote-close", size: "sm", shape: "round", title: false, icon: ownIcon(props.close === true ? undefined : props.close, xIcon),
    label: () => val(props.closeLabel) ?? t`Cancel reply`, onClick: () => props.onClose?.(),
  }) : null);
}
