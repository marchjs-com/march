// ErrorBox (hadi-march/feedback): what went wrong, in words, with a retry button.
import "./error-box.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Alert } from "../alert/index.ts";
import { Button } from "../../actions/button/index.ts";

export interface ErrorBoxProps {
  error?: MaybeFn<unknown>;
  message?: MaybeFn<unknown>;
  title?: unknown;
  retry?: (() => unknown) | undefined;
  /** Content of the retry button: text or a node (default "Retry", translated). */
  retryLabel?: unknown;
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
    tone: "danger", icon: null, actionPlacement: "below", class: () => cx("hm-error", "hm-errorbox", val(props.class)),
    title: props.title != null ? h("span", { class: "hm-errorbox-title" }, () => val(props.title)) : undefined,
    body: h("p", { class: "hm-errorbox-text" }, msg),
    action: props.retry ? h(Button, { variant: "secondary", size: "sm", class: "hm-errorbox-retry", onClick: () => props.retry?.() }, () => val(props.retryLabel) ?? t`Retry`) : undefined,
  }) as () => Element)();
}
