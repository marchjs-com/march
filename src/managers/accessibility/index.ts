// AccessibilityManager: the user's accessibility preferences, kept and applied app-wide, plus a quick page audit.
//
//   import { a11y, configureA11y } from "hadi-march/managers/accessibility";
//   a11y.prefs()                         // { motion, contrast, fontScale, underlineLinks, textSpacing, strongFocus } (reactive)
//   a11y.set({ fontScale: 1.25 })        // saved (localStorage) and applied to <html> at once
//   a11y.reset()
//   a11y.audit(document.body)            // [{ rule, message, el }]: missing alt, unnamed buttons, unlabeled fields…
//
// Applied as attributes on <html> (data-hm-a11y-contrast, -links, -spacing, -focus) that accessibility.css styles,
// a root font-size for text scale (every size is in rem), and the motion engine's reduced-motion override.
// The settings panel is lazy: hadi-march/managers/accessibility/ui.
import "./accessibility.css";
import { signal, untrack } from "../../core/reactive.ts";
import { setReducedOverride } from "../../motion/engine/prefs.ts";
import { focusables } from "../../ui/focus.ts";
import { defineManager, emit } from "../manager.ts";

export type MotionPref = "system" | "reduce" | "full";

export interface A11yPrefs {
  /** Animations: follow the system, always reduce, or always run. */
  motion: MotionPref;
  /** Stronger text and border contrast. */
  contrast: boolean;
  /** Text size multiplier (1 = 100%). Clamped to 0.85…2. */
  fontScale: number;
  /** Underline every link, not only on hover. */
  underlineLinks: boolean;
  /** WCAG 1.4.12 text spacing: line height 1.5, letter 0.12em, word 0.16em. */
  textSpacing: boolean;
  /** A thick, always-visible focus ring. */
  strongFocus: boolean;
}

interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export interface A11yConfig {
  /** Starting preferences (before the user changes anything). */
  defaults: A11yPrefs;
  /** Storage key. Default "hm.a11y". */
  storageKey: string;
  /** Where preferences live. Default localStorage; null keeps them in memory only. */
  storage: KeyStore | null | undefined;
  /** Apply to <html> (default true). */
  apply: boolean;
}

/** One audit finding. `message` is English source text (the UI translates it with t()). */
export interface A11yIssue { rule: string; message: string; el: Element }

export interface A11y {
  prefs(): A11yPrefs;
  set(patch: Partial<A11yPrefs>): A11yPrefs;
  reset(): A11yPrefs;
  /** Check `root` for common problems. */
  audit(root?: Element): A11yIssue[];
  dispose(): void;
}

/** Accessibility preferences before the user changes any (follow the system for motion, no extra contrast, scale 1). */
export const DEFAULT_PREFS: A11yPrefs = { motion: "system", contrast: false, fontScale: 1, underlineLinks: false, textSpacing: false, strongFocus: false };

const clampScale = (n: unknown): number => { const v = Number(n); return Number.isFinite(v) ? Math.min(2, Math.max(0.85, Math.round(v * 100) / 100)) : 1; };
const clean = (p: Partial<A11yPrefs>, base: A11yPrefs): A11yPrefs => ({
  motion: p.motion === "reduce" || p.motion === "full" || p.motion === "system" ? p.motion : base.motion,
  contrast: typeof p.contrast === "boolean" ? p.contrast : base.contrast,
  fontScale: p.fontScale !== undefined ? clampScale(p.fontScale) : base.fontScale,
  underlineLinks: typeof p.underlineLinks === "boolean" ? p.underlineLinks : base.underlineLinks,
  textSpacing: typeof p.textSpacing === "boolean" ? p.textSpacing : base.textSpacing,
  strongFocus: typeof p.strongFocus === "boolean" ? p.strongFocus : base.strongFocus,
});

const storageOf = (c: A11yConfig): KeyStore | null => {
  if (c.storage !== undefined) return c.storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

const FLAGS: [keyof A11yPrefs, string][] = [["contrast", "data-hm-a11y-contrast"], ["underlineLinks", "data-hm-a11y-links"], ["textSpacing", "data-hm-a11y-spacing"], ["strongFocus", "data-hm-a11y-focus"]];

function create(cfg: A11yConfig): A11y {
  const store = storageOf(cfg);
  const load = (): A11yPrefs => {
    try { const raw = JSON.parse(store?.getItem(cfg.storageKey) ?? "null"); return raw && typeof raw === "object" ? clean(raw, cfg.defaults) : { ...cfg.defaults }; } catch { return { ...cfg.defaults }; }
  };
  const prefs = signal<A11yPrefs>(load(), { name: "a11y.prefs" });
  const root = globalThis.document?.documentElement;
  const before = root?.style?.getPropertyValue("font-size") ?? "";

  const apply = (p: A11yPrefs): void => {
    if (!cfg.apply) return;
    setReducedOverride(p.motion === "system" ? null : p.motion === "reduce");
    if (!root) return;
    for (const [k, attr] of FLAGS) { if (p[k]) root.setAttribute(attr, ""); else root.removeAttribute(attr); }
    if (p.fontScale !== 1) root.style.setProperty("font-size", `${p.fontScale * 100}%`);
    else if (before) root.style.setProperty("font-size", before); else root.style.removeProperty("font-size");
  };
  apply(untrack(prefs));

  const commit = (next: A11yPrefs): A11yPrefs => {
    prefs.set(next);
    try { store?.setItem(cfg.storageKey, JSON.stringify(next)); } catch { /* storage blocked: memory only */ }
    apply(next);
    emit("accessibility", "change", next);
    return next;
  };

  // another tab changed the settings
  const onStorage = (e: Event): void => { if ((e as StorageEvent).key === cfg.storageKey) { const p = load(); prefs.set(p); apply(p); } };
  globalThis.addEventListener?.("storage", onStorage);

  return {
    prefs: () => prefs(),
    set: (patch) => commit(clean({ ...untrack(prefs), ...patch }, cfg.defaults)),
    reset: () => { try { store?.removeItem(cfg.storageKey); } catch { /* ignore */ } return commit({ ...cfg.defaults }); },
    audit: (r) => audit(r ?? globalThis.document?.body),
    dispose() {
      globalThis.removeEventListener?.("storage", onStorage);
      apply({ ...DEFAULT_PREFS });
    },
  };
}

// ------------------------------------------------------------------ audit
const nameOf = (el: Element): string => {
  const d = el.ownerDocument;
  const by = el.getAttribute("aria-labelledby");
  if (by) return by.split(/\s+/).map((id) => d.getElementById(id)?.textContent ?? "").join(" ").trim();
  return (el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.textContent ?? "").trim()
    || Array.from(el.querySelectorAll("img[alt],svg[aria-label]")).map((x) => x.getAttribute("alt") ?? x.getAttribute("aria-label") ?? "").join("").trim();
};
const fieldLabel = (el: Element): boolean => {
  if ((el.getAttribute("aria-label") ?? "").trim() || el.getAttribute("aria-labelledby") || el.closest("label")) return true;
  const id = el.getAttribute("id");
  return !!id && !!el.ownerDocument.querySelector(`label[for="${CSS_ESCAPE(id)}"]`);
};
const CSS_ESCAPE = (s: string): string => (globalThis.CSS?.escape ? globalThis.CSS.escape(s) : s.replace(/["\\]/g, "\\$&"));
const hiddenEl = (el: Element): boolean => !!el.closest("[hidden],[inert]");

/** Common problems under `root`: no alt, no accessible name, no label, duplicate ids, positive tabindex, skipped
 *  heading levels, focusable content inside aria-hidden. Not a replacement for a full audit tool. */
export function audit(root: Element | undefined): A11yIssue[] {
  if (!root) return [];
  const out: A11yIssue[] = [];
  const add = (rule: string, message: string, el: Element): void => { if (!hiddenEl(el)) out.push({ rule, message, el }); };
  for (const el of root.querySelectorAll("img")) if (!el.hasAttribute("alt")) add("img-alt", "Image has no alt text.", el);
  for (const el of root.querySelectorAll("button, a[href], [role=button], [role=link], [role=menuitem], [role=tab]")) if (!nameOf(el)) add("name", "Control has no accessible name.", el);
  const NO_LABEL = new Set(["hidden", "button", "submit", "reset", "image"]);
  for (const el of root.querySelectorAll("input, select, textarea")) if (!NO_LABEL.has((el.getAttribute("type") ?? "").toLowerCase()) && !fieldLabel(el)) add("label", "Form field has no label.", el);
  const seen = new Map<string, Element>();
  for (const el of root.querySelectorAll("[id]")) { const id = el.getAttribute("id") as string; if (seen.has(id)) add("duplicate-id", "Duplicate id.", el); else seen.set(id, el); }
  for (const el of root.querySelectorAll("[tabindex]")) if (Number(el.getAttribute("tabindex")) > 0) add("tabindex", "Positive tabindex changes the natural focus order.", el);
  let level = 0;
  for (const el of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const n = Number(el.tagName.slice(1));
    if (level && n > level + 1) add("heading-order", "Heading level skipped.", el);
    level = n;
  }
  for (const el of root.querySelectorAll("[aria-hidden=true]")) if (focusables(el).length) add("hidden-focus", "Focusable element inside aria-hidden.", el);
  return out;
}

const manager = defineManager<A11y, A11yConfig>("accessibility", create, { defaults: DEFAULT_PREFS, storageKey: "hm.a11y", storage: undefined, apply: true });

/** The accessibility manager. Every method goes to the one instance (created on first use). */
export const a11y: A11y = {
  prefs: () => manager.get().prefs(),
  set: (p) => untrack(() => manager.get()).set(p),
  reset: () => untrack(() => manager.get()).reset(),
  audit: (r) => untrack(() => manager.get()).audit(r),
  dispose: () => manager.dispose(),
};
/** Set the accessibility manager's options (merged into the current config). */
export const configureA11y = (config: Partial<A11yConfig>): void => manager.configure(config);
/** Stop the accessibility manager and remove its listeners; the next call starts it again. */
export const disposeA11y = (): void => manager.dispose();
/** The accessibility manager (get, configure, dispose). */
export const a11yManager = manager;
