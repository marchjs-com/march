// Modal dialogs and side sheets: focus trap, Escape, overlay click (when dismissable), focus restore, aria-modal, stacking.
// Imperative helpers return promises: confirm() → boolean, prompt() → string|null, askReason() → string|{category,text}|null,
// openDialog((close) => content) → whatever close(value) received (undefined when dismissed).
import "./dialog.css";
import "./button.css";
import "./field.css";
import { signal, createRoot, onCleanup, untrack, type Signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Portal } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { val, cx, uid, glyph, type MaybeFn } from "./util.ts";
import { x as xIcon } from "../icons/set.ts";
import { trapTab, focusables } from "./focus.ts";

export type DialogSize = "sm" | "md" | "lg" | "full";
export type DrawerSide = "left" | "right" | "bottom";
/** Text shown in a dialog: a string or an accessor. */
export type Label = MaybeFn<string>;

interface StackEntry { dismissable: () => boolean; close: () => void }
const stack: StackEntry[] = [];
let keysOn = false;
function installKeys(): void {
  if (keysOn || !globalThis.document) return;
  keysOn = true;
  globalThis.document.addEventListener("keydown", (e) => {
    const top = stack[stack.length - 1];
    if (!top || e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    if (top.dismissable()) top.close();
  });
}
/** Number of open dialogs. */
export const openDialogs = (): number => stack.length;
/** Close every open dialog (dismiss). */
export function closeAll(): void { for (const d of [...stack].reverse()) d.close(); }

/** Options of the modal frame (overlay + panel). */
export interface FrameOptions {
  title?: unknown;
  size?: MaybeFn<DialogSize | undefined>;
  dismissable?: MaybeFn<boolean | undefined>;
  onClose: () => void;
  kind?: "dialog" | "drawer";
  side?: DrawerSide | undefined;
  class?: string | undefined;
  role?: string | undefined;
  footer?: unknown;
  children: unknown;
  label?: string | undefined;
}

/** Build a modal frame (overlay + panel). Must run inside an owner; the frame unregisters and restores focus on cleanup. */
export function frame(o: FrameOptions): HTMLElement {
  installKeys();
  const d = globalThis.document;
  const titleId = uid("hm-dlg");
  const restore = d.activeElement as HTMLElement | null;
  const dismissable = (): boolean => val(o.dismissable) !== false;
  const entry: StackEntry = { dismissable, close: () => o.onClose() };
  stack.push(entry);
  d.documentElement.classList.add("hm-scroll-lock");
  let panel: HTMLElement | undefined, body: HTMLElement | undefined, down: boolean | null = null;
  const drawer = o.kind === "drawer";
  const overlay = h("div", {
    class: cx("hm-overlay", drawer && "hm-overlay-drawer"),
    onPointerdown: (e: Event) => { down = e.target === overlay; },
    onClick: (e: Event) => { if (e.target === overlay && down !== false && dismissable()) o.onClose(); down = null; },
  },
  h("div", {
    ref: (x: HTMLElement) => { panel = x; },
    class: cx(drawer ? `hm-drawer hm-drawer-${o.side ?? "right"}` : `hm-dialog hm-dialog-${val(o.size) ?? "md"}`, o.class),
    role: o.role ?? "dialog", "aria-modal": "true", tabindex: "-1",
    "aria-labelledby": o.title != null ? titleId : null, "aria-label": o.title == null ? o.label ?? null : null,
    onKeydown: (e: KeyboardEvent) => { if (panel) trapTab(panel)(e); },
  },
  o.title != null && h("div", { class: "hm-dialog-head" },
    h("h2", { id: titleId, class: "hm-dialog-title" }, () => val(o.title)),
    () => dismissable() && h("button", { type: "button", class: "hm-icon-btn hm-dialog-x", "aria-label": () => t`Close`, onClick: () => o.onClose() }, glyph(xIcon))),
  h("div", { class: "hm-dialog-body", ref: (x: HTMLElement) => { body = x; } }, o.children),
  o.footer != null && h("div", { class: "hm-dialog-foot" }, o.footer))) as HTMLElement;
  queueMicrotask(() => {
    if (!panel?.isConnected) return;
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? (body && focusables(body)[0]) ?? focusables(panel)[0] ?? panel).focus();
  });
  onCleanup(() => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) d.documentElement.classList.remove("hm-scroll-lock");
    if (restore && restore !== d.body && restore.isConnected) restore.focus?.();
  });
  return overlay;
}

/** Options of openDialog() / openDrawer(). `T` = the value `close(value)` resolves with. */
export interface DialogOptions<T = unknown> {
  title?: unknown;
  size?: MaybeFn<DialogSize | undefined>;
  dismissable?: boolean;
  footer?: (close: (value: T) => void) => unknown;
  kind?: "dialog" | "drawer";
  side?: DrawerSide;
  class?: string;
  role?: string;
  /** Resolved when the dialog is dismissed (Escape, overlay, ×). Default undefined. */
  dismissValue?: T;
}

/**
 * Open a dialog imperatively. `render(close)` returns the content; `close(value)` resolves the promise.
 * Resolves `dismissValue` (default undefined) when dismissed.
 */
export function openDialog<T>(render: (close: (value: T) => void) => unknown, opts: DialogOptions<T> & { dismissValue: T }): Promise<T>;
export function openDialog<T = unknown>(render: (close: (value?: T) => void) => unknown, opts?: DialogOptions<T | undefined>): Promise<T | undefined>;
export function openDialog(render: (close: (value?: unknown) => void) => unknown, opts: DialogOptions = {}): Promise<unknown> {
  return new Promise((resolve) => {
    createRoot((dispose) => {
      let done = false;
      const close = (v?: unknown): void => { if (done) return; done = true; dispose(); resolve(v); };
      const node = untrack(() => frame({ ...opts, onClose: () => close(opts.dismissValue), children: render(close), footer: opts.footer?.(close) }));
      globalThis.document.body.appendChild(node);
      onCleanup(() => node.remove());
    }, null);
  });
}

/** Open a side sheet imperatively (same contract as openDialog). */
export function openDrawer<T>(render: (close: (value: T) => void) => unknown, opts: DialogOptions<T> & { dismissValue: T }): Promise<T>;
export function openDrawer<T = unknown>(render: (close: (value?: T) => void) => unknown, opts?: DialogOptions<T | undefined>): Promise<T | undefined>;
export function openDrawer(render: (close: (value?: unknown) => void) => unknown, opts: DialogOptions = {}): Promise<unknown> {
  return openDialog(render, { ...opts, kind: "drawer" });
}

const btn = (label: Label, cls: string, onClick: () => void, extra: Record<string, unknown> = {}): Element =>
  h("button", { type: "button", class: `hm-btn ${cls}`, onClick, ...extra }, () => val(label));

export interface ConfirmOptions {
  title?: Label | undefined;
  message?: Label | undefined;
  danger?: boolean | undefined;
  ok?: Label | undefined;
  cancel?: Label | undefined;
}
/** Ask a yes/no question. Resolves true (ok) or false (cancel, Escape, overlay). */
export function confirm({ title, message, danger = false, ok, cancel }: ConfirmOptions = {}): Promise<boolean> {
  return openDialog<boolean>(() => message != null && h("p", { class: "hm-dialog-msg" }, () => val(message)), {
    title: title ?? (() => t`Are you sure?`), size: "sm", role: "alertdialog", dismissValue: false,
    footer: (close) => [
      btn(cancel ?? (() => t`Cancel`), "hm-btn-secondary", () => close(false), { "data-cancel": "", "data-autofocus": danger ? "" : null }),
      btn(ok ?? (() => t`OK`), danger ? "hm-btn-danger" : "hm-btn-primary", () => close(true), { "data-ok": "", "data-autofocus": danger ? null : "" }),
    ],
  });
}

interface FieldOptions {
  id: string; label?: Label | undefined; value: string; multiline: boolean; placeholder?: string | undefined; error: Signal<string | null>;
  onInput: (v: string) => void; onEnter: () => void; rows?: number;
}
// Shared body for prompt/askReason: a labelled field with an error line.
function field({ id, label, value, multiline, placeholder, error, onInput, onEnter, rows = 3 }: FieldOptions): Element {
  const errId = `${id}-err`;
  const input = h(multiline ? "textarea" : "input", {
    id, class: multiline ? "hm-textarea" : "hm-input", value, placeholder: placeholder ?? null, rows: multiline ? rows : null, "data-autofocus": "",
    "aria-invalid": () => (error() ? "true" : null), "aria-describedby": errId,
    onInput: (e: Event) => onInput((e.target as HTMLInputElement).value),
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); onEnter(); } },
  });
  return h("div", { class: "hm-field" },
    label != null && h("label", { class: "hm-label", for: id }, () => val(label)), input,
    h("div", { id: errId, class: "hm-field-error", role: "alert" }, () => error() ?? ""));
}

export interface PromptOptions {
  title?: Label | undefined;
  message?: Label | undefined;
  label?: Label | undefined;
  value?: string | null | undefined;
  placeholder?: string | undefined;
  /** Returns an error message, or null/undefined when the value is valid. */
  validate?: ((value: string) => string | null | undefined) | undefined;
  ok?: Label | undefined;
  multiline?: boolean | undefined;
}
/** Ask for a text value. `validate(v)` returns an error message or null. Resolves the string, or null when cancelled. */
export function prompt({ title, message, label, value = "", placeholder, validate, ok, multiline = false }: PromptOptions = {}): Promise<string | null> {
  const text = signal(String(value ?? "")), error = signal<string | null>(null);
  let submit = (): void => {};
  return openDialog<string | null>((close) => {
    submit = () => { const v = text.peek(); const err = validate?.(v) ?? null; error.set(err); if (!err) close(v); };
    return [message != null && h("p", { class: "hm-dialog-msg" }, () => val(message)),
      field({ id: uid("hm-prompt"), label, value: text.peek(), multiline, placeholder, error, onInput: (v) => { text.set(v); error.set(null); }, onEnter: () => submit() })];
  }, {
    title: title ?? (() => t`Enter a value`), size: "sm", dismissValue: null,
    footer: (close) => [btn(() => t`Cancel`, "hm-btn-secondary", () => close(null), { "data-cancel": "" }), btn(ok ?? (() => t`OK`), "hm-btn-primary", () => submit(), { "data-ok": "" })],
  });
}

/** A purpose the user picks in askReason(). */
export interface Purpose { value: string; label: Label }
/** askReason() result when `purposes` are given. */
export interface ReasonWithPurpose { category: string; text: string }
export interface AskReasonOptions {
  title?: Label | undefined;
  message?: Label | undefined;
  /** Minimum length of the reason (default 10). */
  min?: number | undefined;
  danger?: boolean | undefined;
  ok?: Label | undefined;
  /** When given (non-empty), a purpose must be chosen too and the result is `{ category, text }`. */
  purposes?: readonly Purpose[] | undefined;
}

/**
 * Ask why the user is doing something (audited actions). Text must be at least `min` characters.
 * With `purposes: [{value,label}]` a purpose must be chosen too and the result is `{ category, text }`.
 * Resolves null when cancelled.
 */
export function askReason(opts: AskReasonOptions & { purposes: readonly Purpose[] }): Promise<ReasonWithPurpose | null>;
export function askReason(opts?: AskReasonOptions & { purposes?: undefined }): Promise<string | null>;
export function askReason(opts?: AskReasonOptions): Promise<string | ReasonWithPurpose | null>;
export function askReason({ title, message, min = 10, danger = false, ok, purposes }: AskReasonOptions = {}): Promise<string | ReasonWithPurpose | null> {
  const text = signal(""), cat = signal(""), error = signal<string | null>(null);
  let submit = (): void => {};
  return openDialog<string | ReasonWithPurpose | null>((close) => {
    submit = () => {
      const v = text.peek().trim();
      if (purposes?.length && !cat.peek()) { error.set(t`Choose a purpose.`); return; }
      if (v.length < min) { error.set(t`Please write at least ${min} characters.`); return; }
      close(purposes?.length ? { category: cat.peek(), text: v } : v);
    };
    const selId = uid("hm-purpose");
    return [message != null && h("p", { class: "hm-dialog-msg" }, () => val(message)),
      purposes?.length && h("div", { class: "hm-field" },
        h("label", { class: "hm-label", for: selId }, () => t`Purpose`),
        h("select", { id: selId, class: "hm-select", onChange: (e: Event) => { cat.set((e.target as HTMLSelectElement).value); error.set(null); } },
          h("option", { value: "" }, () => t`Choose…`),
          purposes.map((p) => h("option", { value: p.value }, () => val(p.label))))),
      field({ id: uid("hm-reason"), label: () => t`Reason`, value: "", multiline: true, error, onInput: (v) => { text.set(v); error.set(null); }, onEnter: () => submit() }),
      h("div", { class: "hm-field-hint", "aria-live": "polite" }, () => `${text().trim().length} / ${min}`)];
  }, {
    title: title ?? (() => t`Reason`), size: "sm", dismissValue: null,
    footer: (close) => [btn(() => t`Cancel`, "hm-btn-secondary", () => close(null), { "data-cancel": "" }),
      btn(ok ?? (() => t`Continue`), danger ? "hm-btn-danger" : "hm-btn-primary", () => submit(), { "data-ok": "" })],
  });
}

/** Props of <Dialog> and <Drawer>. */
export interface DialogProps {
  open: MaybeFn<boolean | null | undefined>;
  onClose?: () => void;
  title?: unknown;
  size?: MaybeFn<DialogSize>;
  /** false: Escape, the overlay and × do not close it. */
  dismissable?: boolean;
  class?: string;
  /** Accessible name when there is no title. */
  label?: string;
  footer?: unknown;
  children?: unknown;
  /** Drawer only. */
  side?: DrawerSide;
}

function sheet(kind: "dialog" | "drawer"): (props: DialogProps) => () => unknown {
  return (props) => () => {
    if (!val(props.open)) return null;
    return h(Portal, { children: untrack(() => frame({
      kind, side: props.side, title: props.title === undefined ? undefined : () => val(props.title), size: () => val(props.size),
      dismissable: () => props.dismissable, class: props.class, label: props.label,
      onClose: () => props.onClose?.(), footer: props.footer, children: props.children,
    })) });
  };
}
/** Declarative dialog: `<Dialog open={$open} onClose={() => $open = false} title="…" size="md" footer={…}>…</Dialog>` */
export const Dialog: (props: DialogProps) => () => unknown = sheet("dialog");
/** Declarative side sheet: `<Drawer open={$open} onClose={…} side="right" title="…">…</Drawer>` */
export const Drawer: (props: DialogProps) => () => unknown = sheet("drawer");
