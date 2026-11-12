// ErrorBox (hadi-march/feedback): what went wrong, in words, with a retry button.
import "./error-box.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface ErrorBoxProps {
  error?: MaybeFn<unknown>;
  message?: MaybeFn<unknown>;
  title?: unknown;
  retry?: (() => unknown) | undefined;
  class?: ClassProp;
}
/** `<ErrorBox error={err} retry={() => refetch()} title="Could not load" />` */
export function ErrorBox(props: ErrorBoxProps): Element {
  const msg = (): string => {
    const e = val(props.error) ?? val(props.message);
    const m = e != null && typeof e === "object" ? (e as { message?: unknown }).message : undefined;
    return (m as string | undefined) ?? (e != null ? String(e) : t`Something went wrong.`);
  };
  return h("div", { class: () => cx("hm-error", "hm-errorbox", val(props.class)), role: "alert" },
    props.title != null && h("strong", { class: "hm-errorbox-title" }, () => val(props.title)),
    h("p", {}, msg),
    props.retry && h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: () => props.retry?.() }, () => t`Retry`));
}
