// hadi-march/errors: one collector for every error — window.onerror, unhandled rejections, <Try>/<Outlet> boundaries,
// net and WebSocket failures — normalized to AppError, de-duplicated, shown by rules, optionally reported.
//
//   import { errors, ErrorPage } from "hadi-march/errors";
//   errors.install({ dev: import.meta.env?.DEV });
//   errors.rule({ type: "auth" }, "page");              // toast | inline | page | silent | (e) => …
//   errors.rule({ type: "validation" }, "inline");      // <ErrorInline target="profile" />  (context.target)
//   errors.report((e) => myLogger.send(e));             // default: reported nowhere
import "./errors.css";
import { signal, batch, createRoot, setErrorHook, type Signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Portal } from "../dom/portal.ts";
import { For } from "../dom/for.ts";
import { t } from "../core/i18n.ts";
import { AppError, setErrorSink, isAbort, type AppErrorInit, type ErrorType, type Severity, type ErrorSource } from "./app-error.ts";

export { AppError, isAbort, setErrorSink, emitError } from "./app-error.ts";
export type { AppErrorInit, ErrorType, Severity, ErrorSource } from "./app-error.ts";

export type DisplayName = "toast" | "inline" | "page" | "silent";
export type Display = DisplayName | ((e: AppError) => void);
export type Match = Partial<Pick<AppError, "type" | "code" | "status" | "severity" | "source">> | ((e: AppError) => boolean);
interface Rule { match: Match; show: Display }

/** One de-duplicated error: the same type/code/status/message/source within `window` ms counts up instead. */
export interface Captured { id: number; key: string; error: AppError; count: number; first: number; last: number; shown: DisplayName | "custom" }
export type ErrorEventName = "error:captured" | "error:shown" | "error:reported" | "error:cleared";

const TEXT: Partial<Record<ErrorType, () => string>> = {
  network: () => t`Network error. Check your connection.`,
  offline: () => t`You are offline.`,
  timeout: () => t`The request took too long.`,
  auth: () => t`Please sign in again.`,
  forbidden: () => t`You do not have permission to do this.`,
  notFound: () => t`Not found`,
  validation: () => t`Please check the highlighted fields.`,
  conflict: () => t`This was changed by someone else. Reload and try again.`,
  rateLimit: () => t`Too many requests. Please wait a moment.`,
  server: () => t`Server error. Please try again later.`,
};

const matches = (m: Match, e: AppError): boolean =>
  typeof m === "function" ? m(e) : Object.entries(m).every(([k, v]) => (e as unknown as Record<string, unknown>)[k] === v);

let seq = 0;
const listeners = new Map<string, Set<(c: Captured) => void>>();
const rules: Rule[] = [];
const recent = new Map<string, Captured>();
const seen = new WeakSet<object>();
const inlineSigs = new Map<string, Signal<AppError | null>>();
let reporter: ((e: ReturnType<typeof plain>, c: Captured) => unknown) | null = null;
let dedupeMs = 3000;
let installed = false;
let devRoot: unknown = null;

const toastDisplay = (e: AppError): void => {
  void import("../ui/toast.ts").then(({ toast }) => toast(errors.message(e), { kind: e.severity === "warning" ? "warn" : e.severity === "info" ? "info" : "danger" }));
};
const displays: Record<Exclude<DisplayName, "silent">, (e: AppError) => void> = {
  toast: toastDisplay,
  page: (e) => errors.page.set(e),
  inline: (e) => { const k = String(e.context["target"] ?? ""); if (k) errors.inline(k).set(e); else toastDisplay(e); },
};

// built-in rules, after the app's own
const DEFAULTS: Rule[] = [
  { match: (e) => isAbort(e) || e.severity === "info", show: "silent" },
  { match: { source: "ws", severity: "warning" }, show: "silent" },
  // a boundary that caught the error already shows its fallback
  { match: (e) => e.source === "boundary" && e.context["handled"] === true, show: "silent" },
  { match: (e) => e.type === "validation" && !!e.context["target"], show: "inline" },
  { match: { severity: "fatal" }, show: "page" },
  { match: () => true, show: "toast" },
];

/** A JSON-safe copy for reporting (no cause objects, no response bodies, no DOM). */
function plain(e: AppError): { type: ErrorType; code: string; status: number; severity: Severity; source: ErrorSource; message: string; retryable: boolean; stack?: string | undefined; context: Record<string, unknown> } {
  const context: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e.context)) if (k !== "body" && (v == null || ["string", "number", "boolean"].includes(typeof v))) context[k] = v;
  return { type: e.type, code: e.code, status: e.status, severity: e.severity, source: e.source, message: e.message, retryable: e.retryable, stack: e.stack, context };
}

function emit(name: ErrorEventName, c: Captured): void { for (const fn of listeners.get(name) ?? []) { try { fn(c); } catch { /* a listener must not break capture */ } } }

/** Captured errors: recent list, listeners, report and clear. */
export const errors = {
  /** Recent errors, newest first (max 50, de-duplicated). */
  list: signal<Captured[]>([]),
  /** The error shown as a full page (rule "page"); <ErrorPage /> renders it. */
  page: signal<AppError | null>(null),

  /** Inline error slot for a target (rule "inline" uses `error.context.target`). */
  inline(target: string): Signal<AppError | null> {
    let s = inlineSigs.get(target);
    if (!s) inlineSigs.set(target, (s = signal<AppError | null>(null)));
    return s;
  },

  /** Collect an error: normalize, de-duplicate, show by rule, report. Returns the AppError. */
  capture(e: unknown, init: AppErrorInit = {}): AppError {
    const err = AppError.from(e, init);
    if (e && typeof e === "object") { if (seen.has(e)) return err; seen.add(e); }
    if (seen.has(err) && err !== e) return err;
    seen.add(err);
    const key = [err.type, err.code, err.status, err.message, err.source].join("|");
    const at = Date.now();
    const prev = recent.get(key);
    if (prev && at - prev.last < dedupeMs) {
      prev.count++; prev.last = at;
      errors.list.set([...errors.list.peek()]);
      return err;
    }
    const rule = [...rules, ...DEFAULTS].find((r) => matches(r.match, err)) as Rule;
    const c: Captured = { id: ++seq, key, error: err, count: 1, first: at, last: at, shown: typeof rule.show === "function" ? "custom" : rule.show };
    recent.set(key, c);
    if (recent.size > 200) recent.delete(recent.keys().next().value as string);
    batch(() => errors.list.set([c, ...errors.list.peek()].slice(0, 50)));
    emit("error:captured", c);
    if (typeof rule.show === "function") rule.show(err); else if (rule.show !== "silent") displays[rule.show](err);
    if (c.shown !== "silent") emit("error:shown", c);
    if (reporter && !isAbort(err)) { try { void Promise.resolve(reporter(plain(err), c)).then(() => emit("error:reported", c), () => undefined); } catch { /* reporting must never throw */ } }
    return err;
  },

  /** Show errors matching `match` this way (checked in the order added, before the built-in rules). Returns a remover. */
  rule(match: Match, show: Display): () => void {
    const r: Rule = { match, show };
    rules.push(r);
    return () => { const i = rules.indexOf(r); if (i >= 0) rules.splice(i, 1); };
  },

  /** Replace how a display works (e.g. your own toast). */
  display(name: Exclude<DisplayName, "silent">, fn: (e: AppError) => void): void { displays[name] = fn; },

  /** Report hook (once per de-duplicated error, JSON-safe copy). Default: errors are reported nowhere. */
  report(fn: ((e: ReturnType<typeof plain>, c: Captured) => unknown) | null): void { reporter = fn; },

  /** Subscribe to error:* events. */
  on(name: ErrorEventName, fn: (c: Captured) => void): () => void {
    let s = listeners.get(name);
    if (!s) listeners.set(name, (s = new Set()));
    s.add(fn);
    return () => s.delete(fn);
  },

  /** The user-facing text of an error (translated). Server messages are shown only for validation/conflict errors. */
  message(e: AppError): string {
    if ((e.type === "validation" || e.type === "conflict" || e.type === "http") && e.message && !/^HTTP \d+$/.test(e.message)) return e.message;
    return TEXT[e.type]?.() ?? t`Something went wrong.`;
  },

  /** Clear the page error, an inline slot, or everything. */
  clear(what?: "page" | { target: string }): void {
    if (what === "page" || what === undefined) errors.page.set(null);
    if (what && typeof what === "object") errors.inline(what.target).set(null);
    if (what === undefined) { for (const s of inlineSigs.values()) s.set(null); errors.list.set([]); recent.clear(); }
  },

  /** Start collecting: window errors, unhandled rejections, boundaries, net / WebSocket failures; `dev` shows the
   *  developer layer. Safe to call more than once. */
  install(o: { window?: boolean; boundaries?: boolean; dev?: boolean; dedupe?: number } = {}): void {
    if (o.dedupe != null) dedupeMs = o.dedupe;
    if (o.dev) errors.dev(true);
    setErrorSink((e) => { errors.capture(e); });
    if (o.boundaries !== false) setErrorHook((e, handled) => { if (!isAbort(e)) errors.capture(e, { source: "boundary", context: { handled } }); });
    const g = globalThis as unknown as { addEventListener?: (n: string, f: (e: never) => void) => void };
    if (o.window !== false && g.addEventListener && !installed) {
      installed = true;
      g.addEventListener("error", (ev: { error?: unknown; message?: string }) => { errors.capture(ev.error ?? ev.message, { source: "window" }); });
      g.addEventListener("unhandledrejection", (ev: { reason?: unknown; preventDefault?: () => void }) => { if (isAbort(ev.reason)) { ev.preventDefault?.(); return; } errors.capture(ev.reason, { source: "promise" }); });
    }
  },

  /** Show / hide the developer layer (a list of captured errors with stack, source and count). */
  dev(on: boolean): void {
    if (on && !devRoot && globalThis.document?.body) devRoot = createRoot((dispose) => { h(Portal, { layer: "toast", children: h(DevLayer, {}) }); return dispose; }, null);
    else if (!on && typeof devRoot === "function") { (devRoot as () => void)(); devRoot = null; }
  },
};

/** Full-page error view for rule "page" (put it where the page content goes, e.g. above <Outlet/>). */
export function ErrorPage(props: { children?: unknown }): unknown {
  return () => {
    const e = errors.page();
    if (!e) return props.children ?? null;
    const retry = e.context["retry"];
    return h("div", { class: "hm-error hm-error-page", role: "alert" },
      h("p", { class: "hm-error-title" }, errors.message(e)),
      h("p", { class: "hm-muted" }, `${e.code}${e.status ? ` · ${e.status}` : ""}`),
      h("div", { class: "hm-error-actions" },
        typeof retry === "function" ? h("button", { type: "button", class: "hm-btn hm-btn-primary hm-btn-sm", onClick: () => { errors.clear("page"); (retry as () => void)(); } }, () => t`Try again`) : null,
        h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: () => errors.clear("page") }, () => t`Close`)));
  };
}

/** Inline error for a target (rule "inline"): form section, card, list. */
export function ErrorInline(props: { target: string }): unknown {
  const s = errors.inline(props.target);
  return () => {
    const e = s();
    if (!e) return null;
    const fields = e.context["fields"] as Record<string, unknown> | undefined;
    return h("div", { class: "hm-error hm-error-inline", role: "alert" },
      h("span", {}, errors.message(e)),
      h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", "aria-label": () => t`Close`, onClick: () => s.set(null) }, "×"),
      fields && typeof fields === "object" ? h("ul", { class: "hm-error-fields" }, Object.entries(fields).map(([k, v]) => h("li", {}, `${k}: ${String(v)}`))) : null);
  };
}

function DevLayer(): unknown {
  const open = signal(false);
  return h("aside", { class: "hm-errors-dev", "data-open": () => String(open()), "aria-label": () => t`Errors` },
    h("button", { type: "button", class: "hm-errors-dev-toggle", "aria-expanded": () => String(open()), onClick: () => open.set(!open.peek()) },
      () => `⚠ ${errors.list().reduce((n, c) => n + c.count, 0)}`),
    () => open() ? h("div", { class: "hm-errors-dev-panel" },
      h("div", { class: "hm-errors-dev-head" }, h("strong", {}, () => t`Errors`), h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", onClick: () => errors.clear() }, () => t`Clear`)),
      h("ol", {}, h(For, { each: errors.list, key: "id", children: (c: () => Captured) => h("li", { "data-severity": () => c().error.severity },
        h("div", { class: "hm-errors-dev-row" }, h("code", {}, () => `${c().error.type}/${c().error.code}`), h("span", {}, () => c().error.source), h("span", {}, () => `×${c().count}`), h("span", {}, () => c().shown)),
        h("div", {}, () => c().error.message),
        h("details", {}, h("summary", {}, () => t`Stack`), h("pre", {}, () => (c().error.stack ?? "").split("\n").slice(0, 8).join("\n")))) }))) : null);
}
