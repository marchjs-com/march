// action(): one object describing a user command — label, what it does, and how it must be guarded.
// Buttons, table bulk actions, row menus and the command palette all render the same action, so confirmation,
// permission checks, busy state, error toasts and undo behave identically everywhere.
//
//   const remove = action("Delete", (row) => api.remove(row.id), {
//     danger: true, confirm: (row) => `Delete ${row.name}?`, reason: 10, undo: (res, row) => api.restore(row.id),
//     can: "users.delete", key: "mod+backspace", success: "Deleted",
//   })
//   <ActionButton action={remove} args={[row]} />   or   await remove.run(row)
import { signal, untrack } from "../core/reactive.ts";
import { can as canAccess, type PermCheck } from "../access/index.ts";
import { t } from "../core/i18n.ts";
import { confirm, askReason } from "./dialog.ts";
import { toast } from "./toast.ts";
import type { MaybeFn } from "./util.ts";

/** Callback type checked bivariantly, so actions with specific argument types fit into `Action[]` lists. */
type Fn<A extends unknown[], R> = { bivariant(...args: A): R }["bivariant"];

/** `reason: 10` or `{ min: 10, title: "Why?" }`: ask for an audited reason; it is appended to the action's arguments. */
export interface ReasonOptions { min?: number; title?: string }

/**
 * Options of action(). `A` = the arguments `run()` takes, `R` = the resolved result, `F` = the arguments `fn` receives
 * (A plus the reason string when `reason` is set).
 */
export interface ActionOptions<A extends unknown[] = unknown[], R = unknown, F extends unknown[] = A> {
  /** Ask before running: true, a message, or a message built from the arguments. */
  confirm?: boolean | string | Fn<A, string | false | null | undefined>;
  danger?: boolean;
  reason?: number | ReasonOptions;
  /** Offer "Undo" in the success toast. */
  undo?: Fn<[result: R, ...args: F], unknown>;
  /** Permission check (see access/can). */
  can?: PermCheck;
  /** Shortcut shown in menus and on buttons (e.g. "mod+backspace"). */
  key?: string;
  icon?: unknown;
  /** Success toast text (false = none). */
  success?: string | false | Fn<[result: R], string>;
  hidden?: Fn<A, boolean>;
  disabled?: Fn<A, boolean>;
  id?: string;
  group?: string;
  keywords?: string;
}

/** A guarded user command. Render it with <ActionButton>, <Menu items>, table actions or the command palette. */
export interface Action<A extends unknown[] = unknown[], R = unknown> {
  readonly kind: "march.action";
  readonly id: string | undefined;
  readonly opts: ActionOptions<A, R, unknown[]>;
  label(): string;
  /** Reactive: is the action running? */
  busy(): boolean;
  /** Reactive: may the current user see this action? */
  allowed(): boolean;
  visible(...args: A): boolean;
  disabled(...args: A): boolean;
  /** Run with confirmation, reason, busy state, toasts and undo. Resolves to the result, or undefined if cancelled. */
  run(...args: A): Promise<R | undefined>;
}

const errorOf = (e: unknown): { code?: unknown; message?: unknown } => (e != null && typeof e === "object" ? e : {});

/** With `reason`, `fn` receives the reason string as its last argument; `run()` takes the arguments before it. */
export function action<A extends unknown[], R>(label: MaybeFn<string>, fn: (...args: [...A, string]) => R,
  opts: ActionOptions<A, Awaited<R>, [...A, string]> & { reason: number | ReasonOptions }): Action<A, Awaited<R>>;
export function action<A extends unknown[], R>(label: MaybeFn<string>, fn: (...args: A) => R, opts?: ActionOptions<A, Awaited<R>>): Action<A, Awaited<R>>;
export function action(label: MaybeFn<string>, run: (...args: never[]) => unknown, options?: object): Action {
  const fn = run as (...args: unknown[]) => unknown;
  const opts: ActionOptions = options ?? {};
  const busy = signal(false);
  const a: Action = {
    kind: "march.action",
    id: opts.id ?? (typeof label === "string" ? label : undefined),
    label: () => (typeof label === "function" ? label() : label),
    opts,
    busy: () => busy(),
    allowed: () => canAccess(opts.can),
    visible: (...args) => canAccess(opts.can) && !(opts.hidden?.(...args)),
    disabled: (...args) => busy() || !!opts.disabled?.(...args),
    async run(...args) {
      if (untrack(busy)) return undefined;
      if (!untrack(() => canAccess(opts.can))) { toast(t`You are not allowed to do this.`, { kind: "danger" }); return undefined; }
      const text = typeof opts.confirm === "function" ? opts.confirm(...args) : opts.confirm;
      if (opts.reason) {
        const r: ReasonOptions = typeof opts.reason === "number" ? { min: opts.reason } : opts.reason;
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
        const undo = opts.undo;
        if (undo) {
          toast(msg || t`Done`, { kind: "success", action: { label: t`Undo`, run: () => undo(res, ...args) } });
        } else if (msg) toast(msg, { kind: "success" });
        return res;
      } catch (e) {
        const err = errorOf(e);
        if (err.code !== "cancelled") toast((err.message as string | undefined) || t`Something went wrong.`, { kind: "danger" });
        throw e;
      } finally {
        busy.set(false);
      }
    },
  };
  return a;
}
export const isAction = (v: unknown): v is Action => (v as { kind?: unknown } | null | undefined)?.kind === "march.action";
