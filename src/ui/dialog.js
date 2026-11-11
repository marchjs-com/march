// Modal dialogs and side sheets: focus trap, Escape, overlay click (when dismissable), focus restore, aria-modal, stacking.
// Imperative helpers return promises: confirm() → boolean, prompt() → string|null, askReason() → string|{category,text}|null,
// openDialog((close) => content) → whatever close(value) received (undefined when dismissed).
import { signal, createRoot, onCleanup, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Portal } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { val, cx, uid } from "./util.js";
import { trapTab, focusables } from "./focus.js";

const stack = [];
let keysOn = false;
function installKeys() {
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
export const openDialogs = () => stack.length;
/** Close every open dialog (dismiss). */
export function closeAll() { for (const d of [...stack].reverse()) d.close(); }

/**
 * Build a modal frame (overlay + panel). Must run inside an owner; the frame unregisters and restores focus on cleanup.
 * @param {{ title?: any, size?: "sm"|"md"|"lg"|"full", dismissable?: any, onClose: () => void, kind?: "dialog"|"drawer",
 *           side?: "left"|"right"|"bottom", class?: string, role?: string, footer?: any, children: any, label?: string }} o
 */
export function frame(o) {
  installKeys();
  const d = globalThis.document;
  const titleId = uid("hm-dlg");
  const restore = d.activeElement;
  const dismissable = () => val(o.dismissable) !== false;
  const entry = { dismissable, close: () => o.onClose() };
  stack.push(entry);
  d.documentElement.classList.add("hm-scroll-lock");
  let panel, body, down = null;
  const drawer = o.kind === "drawer";
  const overlay = h("div", {
    class: cx("hm-overlay", drawer && "hm-overlay-drawer"),
    onPointerdown: (e) => { down = e.target === overlay; },
    onClick: (e) => { if (e.target === overlay && down !== false && dismissable()) o.onClose(); down = null; },
  },
  h("div", {
    ref: (x) => { panel = x; },
    class: cx(drawer ? `hm-drawer hm-drawer-${o.side ?? "right"}` : `hm-dialog hm-dialog-${val(o.size) ?? "md"}`, o.class),
    role: o.role ?? "dialog", "aria-modal": "true", tabindex: "-1",
    "aria-labelledby": o.title != null ? titleId : null, "aria-label": o.title == null ? o.label ?? null : null,
    onKeydown: (e) => trapTab(panel)(e),
  },
  o.title != null && h("div", { class: "hm-dialog-head" },
    h("h2", { id: titleId, class: "hm-dialog-title" }, () => val(o.title)),
    () => dismissable() && h("button", { type: "button", class: "hm-icon-btn hm-dialog-x", "aria-label": () => t`Close`, onClick: () => o.onClose() }, "×")),
  h("div", { class: "hm-dialog-body", ref: (x) => { body = x; } }, o.children),
  o.footer != null && h("div", { class: "hm-dialog-foot" }, o.footer)));
  queueMicrotask(() => {
    if (!panel?.isConnected) return;
    (panel.querySelector("[data-autofocus]") ?? focusables(body)[0] ?? focusables(panel)[0] ?? panel).focus();
  });
  onCleanup(() => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length) d.documentElement.classList.remove("hm-scroll-lock");
    if (restore && restore !== d.body && restore.isConnected) restore.focus?.();
  });
  return overlay;
}

/**
 * Open a dialog imperatively. `render(close)` returns the content; `close(value)` resolves the promise.
 * @param {(close: (v?: any) => void) => any} render
 * @param {{ title?: any, size?: "sm"|"md"|"lg"|"full", dismissable?: boolean, footer?: (close) => any, kind?: "dialog"|"drawer",
 *           side?: string, class?: string, role?: string, dismissValue?: any }} [opts]
 * @returns {Promise<any>}
 */
export function openDialog(render, opts = {}) {
  return new Promise((resolve) => {
    createRoot((dispose) => {
      let done = false;
      const close = (v) => { if (done) return; done = true; dispose(); resolve(v); };
      const node = untrack(() => frame({ ...opts, onClose: () => close(opts.dismissValue), children: render(close), footer: opts.footer?.(close) }));
      globalThis.document.body.appendChild(node);
      onCleanup(() => node.remove());
    }, null);
  });
}

/** Open a side sheet imperatively (same contract as openDialog). */
export const openDrawer = (render, opts = {}) => openDialog(render, { ...opts, kind: "drawer" });

const btn = (label, cls, onClick, extra = {}) => h("button", { type: "button", class: `hm-btn ${cls}`, onClick, ...extra }, () => val(label));

/** Ask a yes/no question. Resolves true (ok) or false (cancel, Escape, overlay). */
export function confirm({ title, message, danger = false, ok, cancel } = {}) {
  return openDialog(() => message != null && h("p", { class: "hm-dialog-msg" }, () => val(message)), {
    title: title ?? (() => t`Are you sure?`), size: "sm", role: "alertdialog", dismissValue: false,
    footer: (close) => [
      btn(cancel ?? (() => t`Cancel`), "hm-btn-secondary", () => close(false), { "data-cancel": "", "data-autofocus": danger ? "" : null }),
      btn(ok ?? (() => t`OK`), danger ? "hm-btn-danger" : "hm-btn-primary", () => close(true), { "data-ok": "", "data-autofocus": danger ? null : "" }),
    ],
  });
}

// Shared body for prompt/askReason: a labelled field with an error line.
function field({ id, label, value, multiline, placeholder, error, onInput, onEnter, rows = 3 }) {
  const errId = `${id}-err`;
  const input = h(multiline ? "textarea" : "input", {
    id, class: multiline ? "hm-textarea" : "hm-input", value, placeholder: placeholder ?? null, rows: multiline ? rows : null, "data-autofocus": "",
    "aria-invalid": () => (error() ? "true" : null), "aria-describedby": errId,
    onInput: (e) => onInput(e.target.value),
    onKeydown: (e) => { if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); onEnter(); } },
  });
  return h("div", { class: "hm-field" },
    label != null && h("label", { class: "hm-label", for: id }, () => val(label)), input,
    h("div", { id: errId, class: "hm-field-error", role: "alert" }, () => error() ?? ""));
}

/**
 * Ask for a text value. `validate(v)` returns an error message or null. Resolves the string, or null when cancelled.
 */
export function prompt({ title, message, label, value = "", placeholder, validate, ok, multiline = false } = {}) {
  const text = signal(String(value ?? "")), error = signal(null);
  let submit;
  return openDialog((close) => {
    submit = () => { const v = text.peek(); const err = validate?.(v) ?? null; error.set(err); if (!err) close(v); };
    return [message != null && h("p", { class: "hm-dialog-msg" }, () => val(message)),
      field({ id: uid("hm-prompt"), label, value: text.peek(), multiline, placeholder, error, onInput: (v) => { text.set(v); error.set(null); }, onEnter: () => submit() })];
  }, {
    title: title ?? (() => t`Enter a value`), size: "sm", dismissValue: null,
    footer: (close) => [btn(() => t`Cancel`, "hm-btn-secondary", () => close(null), { "data-cancel": "" }), btn(ok ?? (() => t`OK`), "hm-btn-primary", () => submit(), { "data-ok": "" })],
  });
}

/**
 * Ask why the user is doing something (audited actions). Text must be at least `min` characters.
 * With `purposes: [{value,label}]` a purpose must be chosen too and the result is `{ category, text }`.
 * Resolves null when cancelled.
 */
export function askReason({ title, message, min = 10, danger = false, ok, purposes } = {}) {
  const text = signal(""), cat = signal(""), error = signal(null);
  let submit;
  return openDialog((close) => {
    submit = () => {
      const v = text.peek().trim();
      if (purposes?.length && !cat.peek()) return error.set(t`Choose a purpose.`);
      if (v.length < min) return error.set(t`Please write at least ${min} characters.`);
      close(purposes?.length ? { category: cat.peek(), text: v } : v);
    };
    const selId = uid("hm-purpose");
    return [message != null && h("p", { class: "hm-dialog-msg" }, () => val(message)),
      purposes?.length && h("div", { class: "hm-field" },
        h("label", { class: "hm-label", for: selId }, () => t`Purpose`),
        h("select", { id: selId, class: "hm-select", onChange: (e) => { cat.set(e.target.value); error.set(null); } },
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

function sheet(kind) {
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
export const Dialog = sheet("dialog");
/** Declarative side sheet: `<Drawer open={$open} onClose={…} side="right" title="…">…</Drawer>` */
export const Drawer = sheet("drawer");
