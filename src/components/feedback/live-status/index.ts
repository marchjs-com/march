// LiveStatus (hadi-march/ui): the line that says what just changed — "3 selected", "21–40 of 120", "Build: 9 – 13 Nov".
// A polite live region (role="status"): shown as text, or only read (`visible={false}`). With `help` a hint line comes
// before it (how to drag, which keys work) that the host points at with aria-describedby. One definition for the
// table engine's counters, DataGrid's row count and the hint + status pair under Scheduler and Gantt.
import "./live-status.css";
import { h } from "../../../dom/h.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";

export interface LiveStatusProps {
  /** What is said: a text, a node or an accessor (children work too). @tr Söylenen: metin, düğüm ya da erişimci (children da olur). */
  text?: MaybeFn<unknown>;
  /** What is said, when `text` is not given. @tr `text` verilmediğinde söylenen. */
  children?: unknown;
  /** `false`: only screen readers get it (visually hidden). Default true. @tr `false`: yalnız ekran okuyucular duyar (görsel olarak gizli). Varsayılan true. */
  visible?: boolean | undefined;
  /** "polite" (default) waits for the reader to finish; "assertive" interrupts. @tr "polite" (varsayılan) okuyucunun bitirmesini bekler; "assertive" araya girer. */
  politeness?: "polite" | "assertive" | undefined;
  /** The element: span (default), div or p. @tr Öğe: span (varsayılan), div ya da p. */
  as?: "span" | "div" | "p" | undefined;
  /** A hint line before the status: a text, a node or an accessor; `false` / unset: none. @tr Durumdan önce bir ipucu satırı: metin, düğüm ya da erişimci; `false` / boş: yok. */
  help?: unknown;
  /** Id of the hint line (for the host's `aria-describedby`). @tr İpucu satırının id'si (ev sahibinin `aria-describedby`'ı için). */
  helpId?: string | undefined;
  /** An extra class on the hint line, for a host that keeps its own class names. @tr İpucu satırına ek sınıf, kendi sınıf adlarını kullanan bir ev sahibi için. */
  helpClass?: string | undefined;
  /** Extra classes on the status element. @tr Durum öğesine eklenen sınıflar. */
  class?: ClassProp;
  /** Other attributes (`id`, `data-*`) go to the status element. */
  [attr: string]: unknown;
}

/** `<LiveStatus text={() => `${$n} selected`} />`, `<LiveStatus visible={false} text={$moved} help="Drag an event to move it" helpId={id} />` */
export function LiveStatus(props: LiveStatusProps): unknown {
  const status = h(props.as ?? "span", {
    ...rest(props, ["text", "children", "visible", "politeness", "as", "help", "helpId", "helpClass"]),
    class: () => cx("m-live-status", props.visible === false && "m-sr-only", val(props.class)), role: "status", "aria-live": props.politeness ?? "polite",
  }, props.text ?? props.children);
  const help = props.help;
  return help == null || help === false ? status : [h("p", { class: cx("m-live-status-help", props.helpClass), id: props.helpId }, help), status];
}
