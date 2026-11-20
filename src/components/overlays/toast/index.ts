// Toasts: short, non-blocking messages. `toast(msg, { kind, action, timeout })` returns an id; `toast.dismiss(id)`.
// A <ToastHost/> is mounted automatically into document.body on first use when the app did not render one.
import "./toast.css";
import { signal, createRoot, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { Portal } from "../../../dom/portal.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Alert } from "../../feedback/alert/index.ts";
import { Button } from "../../actions/button/index.ts";
import type { IconProp } from "../../../icons/types.ts";

export type ToastKind = "info" | "success" | "warn" | "danger";
export interface ToastAction {
  label: MaybeFn<string>;
  run: () => unknown;
  /** Text of the error toast when `run` fails without a message (default "Something went wrong."). */
  error?: MaybeFn<string> | undefined;
}
export interface ToastOptions {
  kind?: ToastKind;
  action?: ToastAction | undefined;
  /** ms; 0 = stays until dismissed. Default: 4s, 8s with an action or for danger. */
  timeout?: number;
  /** The icon: the kind's icon (default), your own (an IconDef, a short string or a node), or false for none. */
  icon?: IconProp;
  /** Theme color token of the icon (default: the kind's color). */
  color?: ColorToken | undefined;
  /** The close (×) button (default true). Without it give a timeout, an action, or dismiss it yourself. */
  closable?: boolean | undefined;
  /** Accessible name of the close button (default "Dismiss"). */
  closeLabel?: MaybeFn<string> | undefined;
  /** Entrance motion: "spring" (default), "fade" or "none". */
  motion?: "spring" | "fade" | "none" | undefined;
  /** Extra class on the toast. */
  class?: string | undefined;
}
/** A visible toast. */
export interface ToastItem extends Pick<ToastOptions, "icon" | "color" | "closable" | "closeLabel" | "motion" | "class"> { id: number; message: unknown; kind: ToastKind; action: ToastAction | null }
export interface Toast {
  /** Show a toast (`message`: string, node or accessor). Returns its id. */
  (message: unknown, opts?: ToastOptions): number;
  /** Remove a toast. */
  dismiss(id: number): void;
  /** Remove every toast. */
  clear(): void;
  /** Current toasts (reactive). */
  list(): ToastItem[];
}

const list = signal<ToastItem[]>([], { name: "toasts" });
// auto-dismiss timers: time left, and the running timeout (none while paused: a pointer or focus is in the stack)
interface Timer { left: number; at: number; run: ReturnType<typeof setTimeout> | undefined }
const timers = new Map<number, Timer>();
let paused = false;
const startTimer = (id: number, t: Timer): void => { t.at = Date.now(); t.run = setTimeout(() => toast.dismiss(id), Math.max(0, t.left)); };
const pauseTimers = (): void => { if (paused) return; paused = true; for (const t of timers.values()) { clearTimeout(t.run); t.run = undefined; t.left -= Date.now() - t.at; } };
const resumeTimers = (): void => { if (!paused) return; paused = false; for (const [id, t] of timers) startTimer(id, t); };
let hosts = 0, autoHost: unknown = null, seq = 0;
// the stacks of the hosts that are not a fallback: while one of them is on screen a fallback host (the automatic one, or
// <ToastHost fallback />) draws nothing, so a toast shows once, where the app put its stack. One that is mounted but not
// shown (a hidden tab or panel) does not count. `ownHosts` changes as they come and go; the list is read again on every
// toast too, so a stack shown or hidden since then is seen then.
const owners = new Set<Element>();
const ownHosts = signal(0);
const shown = (el: Element): boolean => el.isConnected && (typeof el.checkVisibility === "function" ? el.checkVisibility() : true);
const MAX = 5;

/** Show a toast. `timeout` in ms (0 = stays until dismissed). Default: 4s, 8s with an action or for danger. */
export const toast: Toast = Object.assign((message: unknown, opts: ToastOptions = {}): number => {
  const id = ++seq;
  const kind = opts.kind ?? "info";
  const item: ToastItem = { id, message, kind, action: opts.action ?? null, icon: opts.icon, color: opts.color, closable: opts.closable, closeLabel: opts.closeLabel, motion: opts.motion, class: opts.class };
  if (!hosts && !autoHost && globalThis.document?.body) autoHost = createRoot(() => h(Portal, { layer: "toast", children: h(ToastHost, { fallback: true }) }), null) ?? true;
  list.update((l) => [...l, item].slice(-MAX));
  const ms = opts.timeout ?? (opts.action || kind === "danger" ? 8000 : 4000);
  if (ms > 0) { const tm: Timer = { left: ms, at: Date.now(), run: undefined }; timers.set(id, tm); if (!paused) startTimer(id, tm); }
  return id;
}, {
  dismiss(id: number): void {
    clearTimeout(timers.get(id)?.run);
    timers.delete(id);
    list.update((l) => l.filter((x) => x.id !== id));
  },
  clear(): void { for (const x of list.peek()) toast.dismiss(x.id); },
  list: (): ToastItem[] => list(),
});

/** Renders the toast stack. Place once near the root of the app (optional): `<ToastHost position="top-center" />`. */
export function ToastHost(props: {
  /** Corner (or centre) of the screen the stack sits in (default "bottom-end"; start / end follow the writing direction). @tr Yığının durduğu ekran köşesi (ya da ortası) (varsayılan "bottom-end"; start / end yazı yönünü izler). */
  position?: "bottom-end" | "bottom-start" | "bottom-center" | "top-end" | "top-start" | "top-center" | undefined;
  /** Extra classes on the toast stack. @tr Bildirim yığınına eklenen sınıflar. */
  class?: ClassProp;
  /** A fallback stack: it shows the toasts only while no other ToastHost is mounted (a frame that hosts pages which may bring their own). @tr Yedek yığın: bildirimleri yalnız başka bir ToastHost yokken gösterir (kendi yığınını getirebilen sayfaları barındıran bir çerçeve için). */
  fallback?: boolean | undefined;
} = {}): Element {
  const auto = props.fallback === true;
  let stack: Element | null = null;
  hosts++;
  onCleanup(() => { hosts--; if (stack && owners.delete(stack)) ownHosts.update((n) => n + 1); resumeTimers(); });
  // the stack is the one live region (polite); toasts wait while the pointer or the focus is on them (WCAG 2.2.1)
  let hover = false, focus = false;
  const sync = (): void => { if (hover || focus) pauseTimers(); else resumeTimers(); };
  stack = h("div", {
    class: () => cx("m-toasts", props.position && props.position !== "bottom-end" && `m-toasts-${props.position}`, val(props.class)), "aria-live": "polite", "aria-relevant": "additions",
    onMouseenter: () => { hover = true; sync(); }, onMouseleave: () => { hover = false; sync(); },
    onFocusin: () => { focus = true; sync(); },
    onFocusout: (e: FocusEvent) => { if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null)) { focus = false; sync(); } },
  },
    h(For<ToastItem>, { each: auto ? () => { ownHosts(); const l = list(); return [...owners].some(shown) ? [] : l; } : list, key: "id", children: (item) => {
      const x = item.peek();
      const act = x.action;
      const own = x.icon;
      // a toast is a raised Alert: the kind's icon, the message, one action, the close button
      // the toast's colour token: a scope around the Alert that takes no box (its module of common props stays out of
      // start-up)
      const alert = h(Alert, {
        // the stack already speaks (polite): a toast adds no second live region, except danger (assertive)
        tone: x.kind, variant: "raised", role: x.kind === "danger" ? "alert" : "none",
        class: cx(`m-toast m-toast-${x.kind}`, x.motion === "fade" && "m-toast-fade", x.motion === "none" && "m-toast-still", x.class),
        partClass: { icon: "m-toast-icon", body: "m-toast-msg", dismiss: "m-toast-close" },
        icon: own === false ? null : own == null || own === true ? undefined : own, body: () => val(x.message),
        action: act ? h(Button, { variant: "ghost", size: "sm", class: "m-toast-action",
          onClick: async () => { toast.dismiss(x.id); try { await act.run(); } catch (e) { toast((e as { message?: string } | null)?.message || val(act.error) || t`Something went wrong.`, { kind: "danger" }); } } },
          () => val(act.label)) : undefined,
        dismissable: x.closable !== false, dismissLabel: () => val(x.closeLabel) ?? t`Dismiss`, onDismiss: () => toast.dismiss(x.id),
      });
      return x.color ? h("div", { class: "m-toast-scope", "data-m-color": x.color }, alert) : alert;
    } })) as Element;
  if (!auto) { owners.add(stack); ownHosts.update((n) => n + 1); }
  return stack;
}
