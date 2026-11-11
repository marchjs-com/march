// Toasts: short, non-blocking messages. `toast(msg, { kind, action, timeout })` returns an id; `toast.dismiss(id)`.
// A <ToastHost/> is mounted automatically into document.body on first use when the app did not render one.
import { signal, createRoot, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { For, Portal } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { val, type MaybeFn } from "./util.ts";

export type ToastKind = "info" | "success" | "warn" | "danger";
export interface ToastAction { label: MaybeFn<string>; run: () => unknown }
export interface ToastOptions {
  kind?: ToastKind;
  action?: ToastAction;
  /** ms; 0 = stays until dismissed. Default: 4s, 8s with an action or for danger. */
  timeout?: number;
}
/** A visible toast. */
export interface ToastItem { id: number; message: unknown; kind: ToastKind; action: ToastAction | null }
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
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let hosts = 0, autoHost: unknown = null, seq = 0;
const MAX = 5;

/** Show a toast. `timeout` in ms (0 = stays until dismissed). Default: 4s, 8s with an action or for danger. */
export const toast: Toast = Object.assign((message: unknown, opts: ToastOptions = {}): number => {
  const id = ++seq;
  const kind = opts.kind ?? "info";
  const item: ToastItem = { id, message, kind, action: opts.action ?? null };
  if (!hosts && !autoHost && globalThis.document?.body) autoHost = createRoot(() => h(Portal, { children: h(ToastHost, {}) }), null) ?? true;
  list.update((l) => [...l, item].slice(-MAX));
  const ms = opts.timeout ?? (opts.action || kind === "danger" ? 8000 : 4000);
  if (ms > 0) timers.set(id, setTimeout(() => toast.dismiss(id), ms));
  return id;
}, {
  dismiss(id: number): void {
    clearTimeout(timers.get(id));
    timers.delete(id);
    list.update((l) => l.filter((x) => x.id !== id));
  },
  clear(): void { for (const x of list.peek()) toast.dismiss(x.id); },
  list: (): ToastItem[] => list(),
});

/** Renders the toast stack. Place once near the root of the app (optional). */
export function ToastHost(_props?: Record<string, never>): Element {
  hosts++;
  onCleanup(() => { hosts--; });
  return h("div", { class: "hm-toasts", "aria-live": "polite", "aria-relevant": "additions" },
    h(For<ToastItem>, { each: list, key: "id", children: (item) => {
      const x = item.peek();
      const act = x.action;
      return h("div", { class: `hm-toast hm-toast-${x.kind}`, role: x.kind === "danger" ? "alert" : "status" },
        h("div", { class: "hm-toast-msg" }, () => val(x.message)),
        act && h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm hm-toast-action",
          onClick: async () => { toast.dismiss(x.id); try { await act.run(); } catch (e) { toast((e as { message?: string } | null)?.message || t`Something went wrong.`, { kind: "danger" }); } } },
          () => val(act.label)),
        h("button", { type: "button", class: "hm-toast-close", "aria-label": () => t`Dismiss`, onClick: () => toast.dismiss(x.id) }, "×"));
    } }));
}
