// action(): one object describing a user command — label, what it does, and how it must be guarded.
// Buttons, table bulk actions, row menus and the command palette all render the same action, so confirmation,
// permission checks, busy state, error toasts and undo behave identically everywhere.
//
//   const remove = action("Delete", (row) => api.remove(row.id), {
//     danger: true, confirm: (row) => `Delete ${row.name}?`, reason: 10, undo: (res, row) => api.restore(row.id),
//     can: "users.delete", key: "mod+backspace", success: "Deleted",
//   })
//   <ActionButton action={remove} args={[row]} />   or   await remove.run(row)
import { signal, untrack } from "../core/reactive.js";
import { can as canAccess } from "../access/index.js";
import { t } from "../core/i18n.ts";
import { confirm, askReason } from "./dialog.js";
import { toast } from "./toast.js";

/**
 * @param {string | (() => string)} label
 * @param {(...args: any[]) => any} fn  receives the action args; when `reason` is set, the reason string is appended
 * @param {{ confirm?: boolean|string|((...a:any[]) => string), danger?: boolean, reason?: number|{min:number,title?:string},
 *           undo?: (result:any, ...a:any[]) => any, can?: any, key?: string, icon?: string, success?: string|((r:any)=>string)|false,
 *           hidden?: (...a:any[]) => boolean, disabled?: (...a:any[]) => boolean, id?: string, group?: string, keywords?: string }} [opts]
 */
export function action(label, fn, opts = {}) {
  const busy = signal(false);
  const a = {
    kind: "march.action",
    id: opts.id ?? (typeof label === "string" ? label : undefined),
    label: () => (typeof label === "function" ? label() : label),
    opts,
    busy: () => busy(),
    /** Reactive: may the current user see this action? */
    allowed: () => canAccess(opts.can),
    visible: (...args) => canAccess(opts.can) && !(opts.hidden?.(...args)),
    disabled: (...args) => busy() || !!opts.disabled?.(...args),
    /** Run with confirmation, reason, busy state, toasts and undo. Resolves to the result, or undefined if cancelled. */
    async run(...args) {
      if (untrack(busy)) return undefined;
      if (!untrack(() => canAccess(opts.can))) { toast(t`You are not allowed to do this.`, { kind: "danger" }); return undefined; }
      const text = typeof opts.confirm === "function" ? opts.confirm(...args) : opts.confirm;
      if (opts.reason) {
        const r = typeof opts.reason === "number" ? { min: opts.reason } : opts.reason;
        const why = await askReason({ title: r.title ?? untrack(a.label), message: typeof text === "string" ? text : undefined, min: r.min ?? 10, danger: !!opts.danger, ok: untrack(a.label) });
        if (why == null) return undefined;
        args = [...args, why];
      } else if (text || opts.danger) {
        const ok = await confirm({ title: untrack(a.label), message: typeof text === "string" ? text : t`Are you sure?`, danger: !!opts.danger, ok: untrack(a.label) });
        if (!ok) return undefined;
      }
      busy.set(true);
      try {
        const res = await fn(...args);
        const msg = typeof opts.success === "function" ? opts.success(res) : opts.success;
        if (opts.undo) {
          toast(msg || t`Done`, { kind: "success", action: { label: t`Undo`, run: () => opts.undo(res, ...args) } });
        } else if (msg) toast(msg, { kind: "success" });
        return res;
      } catch (e) {
        if (e?.code !== "cancelled") toast(e?.message || t`Something went wrong.`, { kind: "danger" });
        throw e;
      } finally {
        busy.set(false);
      }
    },
  };
  return a;
}
export const isAction = (v) => v?.kind === "march.action";
