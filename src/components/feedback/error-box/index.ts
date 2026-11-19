// ErrorBox (march/feedback): what went wrong, in words, with a retry button.
import "./error-box.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Alert } from "../alert/index.ts";
import { Button } from "../../actions/button/index.ts";

export interface ErrorBoxProps {
  /** The error: its `message` is shown, or the value as text. @tr Hata: `message` alanı, yoksa değerin kendisi metin olarak gösterilir. */
  error?: MaybeFn<unknown>;
  /** The text when there is no `error` (default "Something went wrong.", translated). @tr `error` yokken gösterilen metin (varsayılan "Something went wrong.", çevrilir). */
  message?: MaybeFn<unknown>;
  /** A bold first line. @tr Kalın ilk satır. */
  title?: unknown;
  /** Adds a retry button that calls it (a bare `retry`, as MarchIDE's Properties give it, shows the button only). @tr Bunu çağıran bir yeniden dene düğmesi ekler (çıplak `retry`, MarchIDE'nin Özellikler'inin verdiği gibi, yalnız düğmeyi gösterir). */
  retry?: (() => unknown) | undefined;
  /** Content of the retry button: text or a node (default "Retry", translated). @tr Yeniden dene düğmesinin içeriği: metin ya da düğüm (varsayılan "Retry", çevrilir). */
  retryLabel?: unknown;
  /** Extra classes on the box. @tr Kutuya eklenen sınıflar. */
  class?: ClassProp;
}
/** `<ErrorBox error={err} retry={() => refetch()} title="Could not load" />` */
export function ErrorBox(props: ErrorBoxProps): Element {
  const msg = (): string => {
    const e = val(props.error) ?? val(props.message);
    const m = e != null && typeof e === "object" ? (e as { message?: unknown }).message : undefined;
    return (m as string | undefined) ?? (e != null ? String(e) : t`Something went wrong.`);
  };
  // an Alert in the danger tone without the icon: title, the message, Retry below; never dismissed, so the node is drawn once
  return (h(Alert, {
    tone: "danger", icon: null, actionPlacement: "below", class: () => cx("m-error", "m-errorbox", val(props.class)),
    title: props.title != null ? h("span", { class: "m-errorbox-title" }, () => val(props.title)) : undefined,
    body: h("p", { class: "m-errorbox-text" }, msg),
    action: props.retry ? h(Button, { variant: "secondary", size: "sm", class: "m-errorbox-retry", onClick: () => { if (typeof props.retry === "function") props.retry(); } }, () => val(props.retryLabel) ?? t`Retry`) : undefined,
  }) as () => Element)();
}
