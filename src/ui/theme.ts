// Theme ("system" | "light" | "dark", persisted under localStorage "hm.theme", applied as data-theme on <html>),
// ThemeToggle, LocaleSelect and UpdateBanner (new deploy detection).
import { signal, computed, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale, setLocale } from "../core/i18n.ts";
import { val, cx, on, type MaybeFn, type ClassProp } from "./util.ts";

export type ThemeMode = "system" | "light" | "dark";
const THEME_KEY = "hm.theme";
const MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const isMode = (v: unknown): v is ThemeMode => MODES.includes(v as ThemeMode);
const readTheme = (): ThemeMode => { try { const v = globalThis.localStorage?.getItem(THEME_KEY); return isMode(v) ? v : "system"; } catch { return "system"; } };
const mode = signal<ThemeMode>(readTheme(), { name: "theme" });

function apply(v: ThemeMode): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (v === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", v);
}
apply(mode.peek());

export interface Theme {
  /** Current theme preference (reactive). */
  (): ThemeMode;
  peek(): ThemeMode;
  /** Persist and apply a theme. Throws for unknown modes. */
  set(v: ThemeMode): ThemeMode;
}
/** Current theme preference (reactive). `theme.set("dark")` persists and applies it. */
export const theme: Theme = Object.assign((): ThemeMode => mode(), {
  peek: (): ThemeMode => mode.peek(),
  set: (v: ThemeMode): ThemeMode => {
    if (!isMode(v)) throw new Error(`March: theme must be one of ${MODES.join(", ")}.`);
    mode.set(v);
    try { globalThis.localStorage?.setItem(THEME_KEY, v); } catch { /* storage blocked */ }
    apply(v);
    return v;
  },
});
export const setTheme = theme.set;
/** Effective theme after resolving "system" with prefers-color-scheme (not reactive to OS changes). */
export const resolvedTheme = (): "light" | "dark" => {
  const m = mode();
  return m !== "system" ? m : globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export interface ThemeToggleProps { class?: ClassProp }
/** Cycles system → light → dark. `<ThemeToggle />` */
export function ThemeToggle(props: ThemeToggleProps = {}): Element {
  const labels: Record<ThemeMode, () => string> = { system: () => t`System theme`, light: () => t`Light theme`, dark: () => t`Dark theme` };
  const icons: Record<ThemeMode, string> = { system: "◐", light: "☀", dark: "☾" };
  return h("button", {
    type: "button", class: () => cx("hm-icon-btn", "hm-theme-toggle", val(props.class)),
    "aria-label": () => `${labels[mode()]()} — ${t`change theme`}`, title: () => labels[mode()](),
    onClick: () => theme.set(MODES[(MODES.indexOf(mode.peek()) + 1) % MODES.length] as ThemeMode),
  }, () => icons[mode()]);
}

export interface LocaleOption { value: string; label: string }
export interface LocaleSelectProps {
  /** Locales: `{ value, label }` or plain strings. */
  options: MaybeFn<readonly (LocaleOption | string)[] | null | undefined>;
  label?: MaybeFn<string | undefined>;
  onChange?: (locale: string) => void;
  class?: ClassProp;
}
/** `<LocaleSelect options={[{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }]} />` (strings allowed) */
export function LocaleSelect(props: LocaleSelectProps): Element {
  const opts = (): LocaleOption[] => (val(props.options) ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return h("select", {
    class: () => cx("hm-select", "hm-select-sm", val(props.class)), "aria-label": () => val(props.label) ?? t`Language`,
    onChange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; void setLocale(v); props.onChange?.(v); },
  }, () => opts().map((o) => h("option", { value: o.value, selected: () => locale() === o.value }, o.label)));
}

export interface UpdateBannerProps {
  /** Build id URL (default "/build.txt"). */
  url?: string;
  /** Poll interval in minutes (default 5). */
  every?: number;
  text?: MaybeFn<string | undefined>;
  reloadText?: MaybeFn<string | undefined>;
  onReload?: () => void;
  class?: ClassProp;
}
/**
 * Shows "A new version is available · Reload" when the text at `url` changes (deploys write a build id there).
 * Polls every `every` minutes and when the tab becomes visible. `<UpdateBanner url="/build.txt" every={5} />`
 */
export function UpdateBanner(props: UpdateBannerProps = {}): () => unknown {
  const url = props.url ?? "/build.txt";
  const stale = signal(false), hidden = signal(false);
  let first: string | null = null, alive = true;
  const check = async (): Promise<void> => {
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
  void check();
  const id = setInterval(check, Math.max(0.1, props.every ?? 5) * 60_000);
  onCleanup(() => { alive = false; clearInterval(id); });
  on(globalThis.document, "visibilitychange", () => { if (globalThis.document.visibilityState !== "hidden") void check(); });
  const show = computed(() => stale() && !hidden());
  return () => show() && untrack(() => h("div", { class: () => cx("hm-update", val(props.class)), role: "status", "aria-live": "polite" },
    h("span", {}, () => val(props.text) ?? t`A new version is available`),
    h("button", { type: "button", class: "hm-btn hm-btn-primary hm-btn-sm", onClick: () => (props.onReload ?? (() => globalThis.location.reload()))() }, () => val(props.reloadText) ?? t`Reload`),
    h("button", { type: "button", class: "hm-icon-btn", "aria-label": () => t`Dismiss`, onClick: () => hidden.set(true) }, "×")));
}
