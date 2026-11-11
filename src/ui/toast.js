// Toasts: short, non-blocking messages. `toast(msg, { kind, action, timeout })` returns an id; `toast.dismiss(id)`.
// A <ToastHost/> is mounted automatically into document.body on first use when the app did not render one.
import { signal, createRoot, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { For, Portal } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { val } from "./util.js";

const list = signal([], { name: "toasts" });
const timers = new Map();
let hosts = 0, autoHost = null, seq = 0;
const MAX = 5;

/**
 * Show a toast. @param {any} message string, node or accessor
 * @param {{ kind?: "info"|"success"|"warn"|"danger", action?: { label: string, run: () => any }, timeout?: number }} [opts]
 * `timeout` in ms (0 = stays until dismissed). Default: 4s, 8s with an action or for danger.
 */
export function toast(message, opts = {}) {
  const id = ++seq;
  const kind = opts.kind ?? "info";
  const item = { id, message, kind, action: opts.action ?? null };
  if (!hosts && !autoHost && globalThis.document?.body) autoHost = createRoot(() => h(Portal, { children: h(ToastHost, {}) }), null) ?? true;
  list.update((l) => [...l, item].slice(-MAX));
  const ms = opts.timeout ?? (opts.action || kind === "danger" ? 8000 : 4000);
  if (ms > 0) timers.set(id, setTimeout(() => toast.dismiss(id), ms));
  return id;
}
/** Remove a toast. */
toast.dismiss = (id) => {
  clearTimeout(timers.get(id));
  timers.delete(id);
  list.update((l) => l.filter((x) => x.id !== id));
};
/** Remove every toast. */
toast.clear = () => { for (const x of list.peek()) toast.dismiss(x.id); };
/** Current toasts (reactive). */
toast.list = () => list();

/** Renders the toast stack. Place once near the root of the app (optional). */
export function ToastHost() {
  hosts++;
  onCleanup(() => hosts--);
  return h("div", { class: "hm-toasts", "aria-live": "polite", "aria-relevant": "additions" },
    h(For, { each: list, key: "id" }, (item) => {
      const x = item.peek();
      return h("div", { class: `hm-toast hm-toast-${x.kind}`, role: x.kind === "danger" ? "alert" : "status" },
        h("div", { class: "hm-toast-msg" }, () => val(x.message)),
        x.action && h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm hm-toast-action",
          onClick: async () => { toast.dismiss(x.id); try { await x.action.run(); } catch (e) { toast(e?.message || t`Something went wrong.`, { kind: "danger" }); } } },
          () => val(x.action.label)),
        h("button", { type: "button", class: "hm-toast-close", "aria-label": () => t`Dismiss`, onClick: () => toast.dismiss(x.id) }, "×"));
    }));
}
