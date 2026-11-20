// Modal dialogs and side sheets: focus trap, Escape, overlay click (when dismissable), focus restore, aria-modal, stacking.
// Imperative helpers return promises: confirm() → boolean, prompt() → string|null, askReason() → string|{category,text}|null,
// openDialog((close) => content) → whatever close(value) received (undefined when dismissed).
import "./dialog.css";
import { signal, effect, createRoot, onCleanup, untrack, type Signal } from "../../../core/reactive.ts";
import { h, lazyChildren } from "../../../dom/h.ts";
import { Portal, openLayer } from "../../../dom/portal.ts";
import { overlayScopeFor } from "../../layout/overlay-scope/index.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, type MaybeFn } from "../../../ui/util.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { trapTab, focusables } from "../../../ui/focus.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { Button, type ButtonVariant } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Field } from "../../../forms/field.ts";
import { live } from "../../../forms/util.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { Textarea } from "../../forms/textarea/index.ts";
import { Select } from "../../forms/select/index.ts";
import type { Handler } from "../../../core/util.ts";

export type DialogSize = "sm" | "md" | "lg" | "full";
/** Edge a drawer comes from (`start` / `end` follow the writing direction; `left` / `right` are aliases of them). */
export type DrawerSide = "start" | "end" | "top" | "bottom" | "left" | "right";
/** Entrance of a dialog panel: "scale" (default), "fade", "rise" or "none" (the scrim then appears at once too). */
export type DialogMotion = "scale" | "fade" | "rise" | "none";
/** Text shown in a dialog: a string or an accessor. */
export type Label = MaybeFn<string>;

interface StackEntry { dismissable: () => boolean; close: () => void; modal: boolean }
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
  /** "drawer": the panel of a <Drawer> (it adds its own classes and movement). */
  kind?: "dialog" | "drawer";
  class?: string | undefined;
  role?: string | undefined;
  footer?: unknown;
  children: unknown;
  label?: string | undefined;
  /** false: a non-modal panel (no scroll lock, no aria-modal, no focus trap; the page stays usable). Default true. */
  modal?: boolean | undefined;
  /** The × button in the head: true (default), false (Escape and the scrim still close), or your own icon / node. */
  closeButton?: unknown;
  /** Accessible name of the × button (default "Close"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** Entrance of the panel (default "scale"; a CSS drawer slides in). */
  motion?: DialogMotion | undefined;
}

/** Build a modal frame (overlay + panel). Must run inside an owner; the frame unregisters and restores focus on cleanup. */
export function frame(o: FrameOptions): HTMLElement {
  installKeys();
  const d = globalThis.document;
  const titleId = uid("m-dlg");
  const restore = d.activeElement as HTMLElement | null;
  const dismissable = (): boolean => val(o.dismissable) !== false;
  const modal = o.modal !== false;
  const entry: StackEntry = { dismissable, close: () => o.onClose(), modal };
  stack.push(entry);
  if (modal) d.documentElement.classList.add("m-scroll-lock");
  let panel: HTMLElement | undefined, body: HTMLElement | undefined, down: boolean | null = null;
  const drawer = o.kind === "drawer";
  const overlay = h("div", {
    class: cx("m-overlay", drawer && "m-overlay-drawer", !modal && "is-modeless", o.motion === "none" && "m-motion-none"),
    onPointerdown: (e: Event) => { down = e.target === overlay; },
    onClick: (e: Event) => { if (e.target === overlay && down !== false && dismissable()) o.onClose(); down = null; },
  },
  h("div", {
    ref: (x: HTMLElement) => { panel = x; },
    class: cx(drawer ? "m-drawer" : `m-dialog m-dialog-${val(o.size) ?? "md"}`, o.motion && o.motion !== "scale" && `m-motion-${o.motion}`, o.class),
    role: o.role ?? "dialog", "aria-modal": modal ? "true" : null, tabindex: "-1",
    "aria-labelledby": o.title != null ? titleId : null, "aria-label": o.title == null ? o.label ?? null : null,
    onKeydown: (e: KeyboardEvent) => { if (panel && modal) trapTab(panel)(e); },
  },
  o.title != null && h(PanelHeader, {
    class: "m-dialog-head", size: "lg", title: () => val(o.title), titleAs: "h2", titleId,
    // the × follows `dismissable` (it may change while open), so it sits in the actions slot
    actions: () => dismissable() && o.closeButton !== false && h(IconButton, {
      class: "m-dialog-x", icon: o.closeButton == null || o.closeButton === true ? xIcon : o.closeButton, label: () => val(o.closeLabel) ?? t`Close`, title: false, onClick: () => o.onClose(),
    }),
  }),
  h("div", { class: "m-dialog-body", ref: (x: HTMLElement) => { body = x; } }, o.children),
  o.footer != null && h(PanelHeader, { as: "footer", class: "m-dialog-foot" }, o.footer))) as HTMLElement;
  // a live size swaps only its own class (a drawer panel keeps the classes it adds itself)
  if (!drawer) {
    let sized = `m-dialog-${untrack(() => val(o.size)) ?? "md"}`;
    effect(() => { const next = `m-dialog-${val(o.size) ?? "md"}`; if (next !== sized && panel) { panel.classList.replace(sized, next); sized = next; } });
  }
  queueMicrotask(() => {
    if (!panel?.isConnected) return;
    (panel.querySelector<HTMLElement>("[data-autofocus]") ?? (body && focusables(body)[0]) ?? focusables(panel)[0] ?? panel).focus();
  });
  onCleanup(() => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.some((s) => s.modal)) d.documentElement.classList.remove("m-scroll-lock");
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
  /** "drawer": opens a <Drawer> from `side` instead (what openDrawer() does). */
  kind?: "dialog" | "drawer";
  side?: DrawerSide;
  class?: string;
  role?: string;
  /** Resolved when the dialog is dismissed (Escape, overlay, ×). Default undefined. */
  dismissValue?: T;
  /** Where it opens: the nearest <OverlayScope> (default), the whole page ("page") or a scope element. */
  target?: "nearest" | "page" | HTMLElement;
  /** The × button in the head: true (default), false, or your own icon / node. */
  closeButton?: unknown;
  /** Accessible name of the × button (default "Close"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** Entrance of the panel: "scale" (default), "fade", "rise" or "none". */
  motion?: DialogMotion | undefined;
}

/**
 * Open a dialog imperatively. `render(close)` returns the content; `close(value)` resolves the promise.
 * Resolves `dismissValue` (default undefined) when dismissed.
 */
export function openDialog<T>(render: (close: (value: T) => void) => unknown, opts: DialogOptions<T> & { dismissValue: T }): Promise<T>;
export function openDialog<T = unknown>(render: (close: (value?: T) => void) => unknown, opts?: DialogOptions<T | undefined>): Promise<T | undefined>;
export function openDialog(render: (close: (value?: unknown) => void) => unknown, opts: DialogOptions = {}): Promise<unknown> {
  // where it opens: the caller's <OverlayScope> (a preview, a panel), else the page; target overrides
  const t = opts.target, scope = t === "page" ? null : t instanceof HTMLElement ? t : overlayScopeFor();
  // one drawer: the <Drawer> component, loaded when the first one opens (a dialog does not carry its gestures)
  if (opts.kind === "drawer") return import("../drawer/index.ts").then((m) => m.openSheet(render, opts, scope));
  return new Promise((resolve) => {
    createRoot((dispose) => {
      let done = false;
      const close = (v?: unknown): void => { if (done) return; done = true; dispose(); resolve(v); };
      const node = untrack(() => frame({ ...opts, onClose: () => close(opts.dismissValue), children: render(close), footer: opts.footer?.(close) }));
      onCleanup(openLayer("dialog", node, scope));
    }, null);
  });
}

/** Open a side sheet imperatively (same contract as openDialog): a `<Drawer>` from `side`. */
export function openDrawer<T>(render: (close: (value: T) => void) => unknown, opts: DialogOptions<T> & { dismissValue: T }): Promise<T>;
export function openDrawer<T = unknown>(render: (close: (value?: T) => void) => unknown, opts?: DialogOptions<T | undefined>): Promise<T | undefined>;
export function openDrawer(render: (close: (value?: unknown) => void) => unknown, opts: DialogOptions = {}): Promise<unknown> {
  return openDialog(render, { ...opts, kind: "drawer" });
}

const btn = (label: Label, variant: ButtonVariant, onClick: () => void, extra: Record<string, unknown> = {}): unknown =>
  h(Button, { variant, onClick, ...extra }, () => val(label));

export interface ConfirmOptions {
  title?: Label | undefined;
  message?: Label | undefined;
  danger?: boolean | undefined;
  ok?: Label | undefined;
  cancel?: Label | undefined;
  /** Look of the dialog itself: size, class, the × button and its name, entrance, where it opens. */
  dialog?: Pick<DialogOptions, "size" | "class" | "target" | "closeButton" | "closeLabel" | "motion"> | undefined;
}
/** Ask a yes/no question: `confirm("Delete it?")` or `confirm({ title, message, danger, ok, cancel })`. Resolves true (ok) or false (cancel, Escape, overlay). */
export function confirm(question: ConfirmOptions | Label = {}): Promise<boolean> {
  const { title, message, danger = false, ok, cancel, dialog }: ConfirmOptions = typeof question === "object" && question !== null ? question : { title: question };
  return openDialog<boolean>(() => message != null && h("p", { class: "m-dialog-msg" }, () => val(message)), {
    size: "sm", ...dialog, title: title ?? (() => t`Are you sure?`), role: "alertdialog", dismissValue: false,
    footer: (close) => [
      btn(cancel ?? (() => t`Cancel`), "secondary", () => close(false), { "data-cancel": "", "data-autofocus": danger ? "" : null }),
      btn(ok ?? (() => t`OK`), danger ? "danger" : "primary", () => close(true), { "data-ok": "", "data-autofocus": danger ? null : "" }),
    ],
  });
}

interface FieldOptions {
  id: string; label?: Label | undefined; value: string; multiline: boolean; placeholder?: string | undefined; error: () => string | null;
  onInput: (v: string) => void; onEnter: () => void; rows?: number; help?: (() => string | null) | undefined;
}
// Shared body for prompt/askReason: a labelled field with an error line.
function field({ id, label, value, multiline, placeholder, error, onInput, onEnter, rows = 3, help }: FieldOptions): unknown {
  const control = {
    id, value, placeholder, onChange: onInput, ref: (el: HTMLElement) => el.setAttribute("data-autofocus", ""),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); onEnter(); } },
  };
  // the control is created inside the Field (it reads the field's id, error state and description)
  return h(Field, { id, label: live(() => (label == null ? null : val(label))), error: live(error), help: live(() => help?.() ?? null) },
    lazyChildren(() => (multiline ? h(Textarea, { ...control, rows, autosize: false }) : h(TextInput, control))));
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
  cancel?: Label | undefined;
  multiline?: boolean | undefined;
  /** Look of the dialog itself: size, class, the × button and its name, entrance, where it opens. */
  dialog?: Pick<DialogOptions, "size" | "class" | "target" | "closeButton" | "closeLabel" | "motion"> | undefined;
}
/** Ask for a text value. `validate(v)` returns an error message or null. Resolves the string, or null when cancelled. */
export function prompt({ title, message, label, value = "", placeholder, validate, ok, cancel, multiline = false, dialog }: PromptOptions = {}): Promise<string | null> {
  const text = signal(String(value ?? "")), error = signal<string | null>(null);
  let submit = (): void => {};
  return openDialog<string | null>((close) => {
    submit = () => { const v = text.peek(); const err = validate?.(v) ?? null; error.set(err); if (!err) close(v); };
    return [message != null && h("p", { class: "m-dialog-msg" }, () => val(message)),
      field({ id: uid("m-prompt"), label, value: text.peek(), multiline, placeholder, error, onInput: (v) => { text.set(v); error.set(null); }, onEnter: () => submit() })];
  }, {
    size: "sm", ...dialog, title: title ?? (() => t`Enter a value`), dismissValue: null,
    footer: (close) => [btn(cancel ?? (() => t`Cancel`), "secondary", () => close(null), { "data-cancel": "" }), btn(ok ?? (() => t`OK`), "primary", () => submit(), { "data-ok": "" })],
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
  cancel?: Label | undefined;
  /** Own texts: the field labels, the empty choice of the purpose list and the two error messages. */
  labels?: { reason?: Label; purpose?: Label; choose?: Label; choosePurpose?: Label; tooShort?: (min: number) => string } | undefined;
  /** The "12 / 10" character counter under the field (default true). */
  counter?: boolean | undefined;
  /** Look of the dialog itself: size, class, the × button and its name, entrance, where it opens. */
  dialog?: Pick<DialogOptions, "size" | "class" | "target" | "closeButton" | "closeLabel" | "motion"> | undefined;
}

/**
 * Ask why the user is doing something (audited actions). Text must be at least `min` characters.
 * With `purposes: [{value,label}]` a purpose must be chosen too and the result is `{ category, text }`.
 * Resolves null when cancelled.
 */
export function askReason(opts: AskReasonOptions & { purposes: readonly Purpose[] }): Promise<ReasonWithPurpose | null>;
export function askReason(opts?: AskReasonOptions & { purposes?: undefined }): Promise<string | null>;
export function askReason(opts?: AskReasonOptions): Promise<string | ReasonWithPurpose | null>;
export function askReason({ title, message, min = 10, danger = false, ok, purposes, cancel, labels, counter, dialog }: AskReasonOptions = {}): Promise<string | ReasonWithPurpose | null> {
  const text = signal(""), cat = signal(""), error = signal<string | null>(null), catError = signal<string | null>(null);
  let submit = (): void => {};
  return openDialog<string | ReasonWithPurpose | null>((close) => {
    submit = () => {
      const v = text.peek().trim();
      if (purposes?.length && !cat.peek()) { catError.set(labels?.choosePurpose != null ? val(labels.choosePurpose) : t`Choose a purpose.`); return; }
      if (v.length < min) { error.set(labels?.tooShort ? labels.tooShort(min) : t`Please write at least ${min} characters.`); return; }
      close(purposes?.length ? { category: cat.peek(), text: v } : v);
    };
    const selId = uid("m-purpose");
    return [message != null && h("p", { class: "m-dialog-msg" }, () => val(message)),
      purposes?.length && h(Field, { id: selId, label: live(() => (labels?.purpose != null ? val(labels.purpose) : t`Purpose`)), error: live(catError) },
        lazyChildren(() => h(Select<string>, {
          options: live(() => purposes.map((p) => ({ value: p.value, label: val(p.label) }))),
          placeholder: live(() => (labels?.choose != null ? val(labels.choose) : t`Choose…`)),
          onChange: (v: string | null) => { cat.set(v ?? ""); catError.set(null); },
        }))),
      field({ id: uid("m-reason"), label: () => (labels?.reason != null ? val(labels.reason) : t`Reason`), value: "", multiline: true, error, onInput: (v) => { text.set(v); error.set(null); }, onEnter: () => submit(),
        help: counter !== false ? () => `${text().trim().length} / ${min}` : undefined })];
  }, {
    size: "sm", ...dialog, title: title ?? (() => t`Reason`), dismissValue: null,
    footer: (close) => [btn(cancel ?? (() => t`Cancel`), "secondary", () => close(null), { "data-cancel": "" }),
      btn(ok ?? (() => t`Continue`), danger ? "danger" : "primary", () => submit(), { "data-ok": "" })],
  });
}

/** Props of <Dialog> and <Drawer>. */
export interface DialogProps {
  /** Shown while true. @tr Doğruyken görünür. */
  open: MaybeFn<boolean | null | undefined>;
  /** Called when it asks to close: Escape, the scrim or × (when dismissable). @tr Kapanmak istediğinde çağrılır: Escape, örtü ya da × (dismissable iken). */
  onClose?: Handler<[]> | undefined;
  /** The heading; it also names the dialog. @tr Başlık; pencereyi de adlandırır. */
  title?: unknown;
  /** sm, md (default), lg or full. @tr sm, md (varsayılan), lg ya da full. */
  size?: MaybeFn<DialogSize>;
  /** false: Escape, the overlay and × do not close it. @tr false: Escape, örtü ve × kapatmaz. */
  dismissable?: boolean;
  /** Extra classes on the panel. @tr Panele eklenen sınıflar. */
  class?: string;
  /** Accessible name when there is no title. @tr Başlık yokken erişilebilir ad. */
  label?: string;
  /** The bottom bar (buttons). @tr Alt çubuk (düğmeler). */
  footer?: unknown;
  /** The content. @tr İçerik. */
  children?: unknown;
  /** Drawer only. @tr Yalnız Drawer için. */
  side?: DrawerSide;
  /** false: a non-modal panel (no scrim, no scroll lock, no focus trap; the page stays usable). Default true. @tr false: kipsiz panel (örtü yok, kaydırma kilidi yok, odak tuzağı yok; sayfa kullanılabilir kalır). Varsayılan true. */
  modal?: boolean | undefined;
  /** The × button in the head: true (default), false (Escape and the scrim still close), or your own icon / node. @tr Başlıktaki × düğmesi: true (varsayılan), false (Escape ve örtü yine kapatır) ya da kendi ikonun / düğümün. */
  closeButton?: unknown;
  /** Accessible name of the × button (default "Close"). @tr × düğmesinin erişilebilir adı (varsayılan "Close"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** Entrance of the panel: "scale" (default), "fade", "rise" or "none". @tr Panelin girişi: "scale" (varsayılan), "fade", "rise" ya da "none". */
  motion?: DialogMotion | undefined;
}

/** Declarative dialog: `<Dialog open={$open} onClose={() => $open = false} title="…" size="md" footer={…}>…</Dialog>` */
export function Dialog(props: DialogProps): () => unknown {
  return () => {
    if (!val(props.open)) return null;
    // a non-modal panel sits in a layer that leaves the page usable
    return h(Portal, { layer: props.modal === false ? "popover" : "dialog", children: untrack(() => frame({
      title: props.title === undefined ? undefined : () => val(props.title), size: () => val(props.size),
      dismissable: () => props.dismissable, class: props.class, label: props.label,
      modal: props.modal, closeButton: props.closeButton, closeLabel: () => val(props.closeLabel), motion: props.motion,
      onClose: () => props.onClose?.(), footer: props.footer, children: props.children,
    })) });
  };
}
// <Drawer> lives in src/components/overlays/drawer/ (4 sides, drag to close, snap points, non-modal); it reuses frame(),
// and openDrawer() opens one.
