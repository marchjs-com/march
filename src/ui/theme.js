// Theme ("system" | "light" | "dark", persisted under localStorage "hm.theme", applied as data-theme on <html>),
// ThemeToggle, LocaleSelect and UpdateBanner (new deploy detection).
import { signal, computed, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale, setLocale } from "../core/i18n.ts";
import { val, cx, on } from "./util.js";

const THEME_KEY = "hm.theme";
const MODES = ["system", "light", "dark"];
const readTheme = () => { try { const v = globalThis.localStorage?.getItem(THEME_KEY); return MODES.includes(v) ? v : "system"; } catch { return "system"; } };
const mode = signal(readTheme(), { name: "theme" });

function apply(v) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  v === "system" ? root.removeAttribute("data-theme") : root.setAttribute("data-theme", v);
}
apply(mode.peek());

/** Current theme preference (reactive). `theme.set("dark")` persists and applies it. */
export const theme = () => mode();
theme.peek = () => mode.peek();
theme.set = (v) => {
  if (!MODES.includes(v)) throw new Error(`March: theme must be one of ${MODES.join(", ")}.`);
  mode.set(v);
  try { globalThis.localStorage?.setItem(THEME_KEY, v); } catch { /* storage blocked */ }
  apply(v);
  return v;
};
export const setTheme = theme.set;
/** Effective theme after resolving "system" with prefers-color-scheme (not reactive to OS changes). */
export const resolvedTheme = () => (mode() !== "system" ? mode() : globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** Cycles system → light → dark. `<ThemeToggle />` */
export function ThemeToggle(props = {}) {
  const labels = { system: () => t`System theme`, light: () => t`Light theme`, dark: () => t`Dark theme` };
  const icons = { system: "◐", light: "☀", dark: "☾" };
  return h("button", {
    type: "button", class: () => cx("hm-icon-btn", "hm-theme-toggle", val(props.class)),
    "aria-label": () => `${labels[mode()]()} — ${t`change theme`}`, title: () => labels[mode()](),
    onClick: () => theme.set(MODES[(MODES.indexOf(mode.peek()) + 1) % MODES.length]),
  }, () => icons[mode()]);
}

/** `<LocaleSelect options={[{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }]} />` (strings allowed) */
export function LocaleSelect(props) {
  const opts = () => (val(props.options) ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return h("select", {
    class: () => cx("hm-select", "hm-select-sm", val(props.class)), "aria-label": () => val(props.label) ?? t`Language`,
    onChange: (e) => { setLocale(e.target.value); props.onChange?.(e.target.value); },
  }, () => opts().map((o) => h("option", { value: o.value, selected: () => locale() === o.value }, o.label)));
}

/**
 * Shows "A new version is available · Reload" when the text at `url` changes (deploys write a build id there).
 * Polls every `every` minutes and when the tab becomes visible. `<UpdateBanner url="/build.txt" every={5} />`
 */
export function UpdateBanner(props = {}) {
  const url = props.url ?? "/build.txt";
  const stale = signal(false), hidden = signal(false);
  let first = null, alive = true;
  const check = async () => {
    if (!alive || stale.peek() || typeof globalThis.fetch !== "function") return;
    try {
      const res = await globalThis.fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const text = (await res.text()).trim();
      if (!alive) return;
      if (first == null) first = text;
      else if (text && text !== first) stale.set(true);
    } catch { /* offline: try later */ }
  };
  check();
  const id = setInterval(check, Math.max(0.1, props.every ?? 5) * 60_000);
  onCleanup(() => { alive = false; clearInterval(id); });
  on(globalThis.document, "visibilitychange", () => { if (globalThis.document.visibilityState !== "hidden") check(); });
  const show = computed(() => stale() && !hidden());
  return () => show() && untrack(() => h("div", { class: () => cx("hm-update", val(props.class)), role: "status", "aria-live": "polite" },
    h("span", {}, () => val(props.text) ?? t`A new version is available`),
    h("button", { type: "button", class: "hm-btn hm-btn-primary hm-btn-sm", onClick: () => (props.onReload ?? (() => globalThis.location.reload()))() }, () => val(props.reloadText) ?? t`Reload`),
    h("button", { type: "button", class: "hm-icon-btn", "aria-label": () => t`Dismiss`, onClick: () => hidden.set(true) }, "×")));
}
