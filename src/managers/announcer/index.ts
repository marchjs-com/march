// AnnouncerManager: one pair of live regions for the whole app, so screen readers hear what changed without moving
// focus ("3 results", "Saved", "Upload failed"). Polite waits for the reader to finish; assertive interrupts.
//
//   import { announce, announcer } from "hadi-march/managers/announcer";
//   announce("Saved")                                   // polite
//   announce("Connection lost", { politeness: "assertive" })
//   announcer.history()                                 // last messages (reactive): devtools, demos, tests
//
// The regions live in the layer stack (an "fx" layer, visually hidden), never body.append. The same text twice in a
// row is still read: the region is cleared first and the text set a moment later.
import { signal, untrack } from "../../core/reactive.ts";
import { h } from "../../dom/h.ts";
import { openLayer } from "../../dom/portal.ts";
import { defineManager, emit } from "../manager.ts";

export type Politeness = "polite" | "assertive";

export interface AnnounceOptions {
  politeness?: Politeness;
  /** Clear the region after this many ms (default: config.clearAfter). 0 keeps the text. */
  clearAfter?: number;
}

/** One announced message. */
export interface Announcement { text: string; politeness: Politeness; at: number }

export interface AnnouncerConfig {
  /** Clear after ms (default 7000): a reader that reaches the region later does not read stale text. */
  clearAfter: number;
  /** Messages kept in history() (default 20). */
  historySize: number;
  /** Ignore the same text within this many ms (default 250): a burst of identical updates is read once. */
  dedupeMs: number;
}

export interface Announcer {
  announce(text: string, opts?: AnnounceOptions): void;
  /** Empty both regions. */
  clear(): void;
  /** Recent messages, newest first (reactive). */
  history(): Announcement[];
  /** The live region elements (tests, devtools). */
  regions(): { polite: HTMLElement | null; assertive: HTMLElement | null };
  dispose(): void;
}

// visually hidden, still read (CSSOM: CSP safe)
const HIDDEN: [string, string][] = [["position", "absolute"], ["width", "1px"], ["height", "1px"], ["margin", "-1px"], ["padding", "0"], ["overflow", "hidden"], ["clip-path", "inset(50%)"], ["white-space", "nowrap"], ["border", "0"]];

function create(cfg: AnnouncerConfig): Announcer {
  const history = signal<Announcement[]>([], { name: "announcer.history" });
  let box: HTMLElement | null = null;
  let close: (() => void) | null = null;
  const els: Record<Politeness, HTMLElement | null> = { polite: null, assertive: null };
  const timers: Record<Politeness, ReturnType<typeof setTimeout> | null> = { polite: null, assertive: null };
  let last = { key: "", at: 0 };

  const ensure = (): void => {
    if (box || !globalThis.document?.body) return;
    const region = (p: Politeness): HTMLElement => {
      const el = h("div", { class: `hm-announcer hm-announcer-${p}`, "aria-live": p, "aria-atomic": "true", role: p === "assertive" ? "alert" : "status" }) as HTMLElement;
      for (const [k, v] of HIDDEN) el.style.setProperty(k, v);
      return el;
    };
    els.polite = region("polite");
    els.assertive = region("assertive");
    box = h("div", { class: "hm-announcers" }, els.polite, els.assertive) as HTMLElement;
    close = openLayer("fx", box);
  };


  // the text lands after a short timer, not requestAnimationFrame: frames stop in a background tab
  const announce = (text: string, opts: AnnounceOptions = {}): void => {
    const msg = String(text ?? "").trim();
    if (!msg) return;
    const now = Date.now();
    const p = opts.politeness ?? "polite";
    const key = `${p}:${msg}`;
    if (key === last.key && now - last.at < cfg.dedupeMs) return;
    last = { key, at: now };
    ensure();
    const el = els[p];
    if (el) {
      el.textContent = "";
      const t = timers[p];
      if (t) clearTimeout(t);
      const after = opts.clearAfter ?? cfg.clearAfter;
      // set the text, then (from that moment) clear it after `after` ms
      timers[p] = setTimeout(() => {
        el.textContent = msg;
        timers[p] = after > 0 ? setTimeout(() => { if (el.textContent === msg) el.textContent = ""; timers[p] = null; }, after) : null;
      }, 50);
    }
    history.update((l) => [{ text: msg, politeness: p, at: now }, ...l].slice(0, cfg.historySize));
    emit("announcer", "announce", { text: msg, politeness: p });
  };

  return {
    announce,
    clear() { for (const p of ["polite", "assertive"] as const) { const el = els[p]; if (el) el.textContent = ""; } last = { key: "", at: 0 }; },
    history: () => history(),
    regions: () => { ensure(); return { ...els }; },
    dispose() {
      for (const p of ["polite", "assertive"] as const) { const t = timers[p]; if (t) clearTimeout(t); timers[p] = null; }
      close?.();
      close = null; box = null; els.polite = null; els.assertive = null;
      history.set([]);
    },
  };
}

const manager = defineManager<Announcer, AnnouncerConfig>("announcer", create, { clearAfter: 7000, historySize: 20, dedupeMs: 250 });

/** Say `text` to screen readers (polite by default). */
export const announce = (text: string, opts?: AnnounceOptions): void => untrack(() => manager.get()).announce(text, opts);
/** The announcer manager. Every method goes to the one instance (created on first use). */
export const announcer: Announcer = {
  announce,
  clear: () => untrack(() => manager.get()).clear(),
  history: () => manager.get().history(),
  regions: () => untrack(() => manager.get()).regions(),
  dispose: () => manager.dispose(),
};
/** Set the announcer manager's options (merged into the current config). */
export const configureAnnouncer = (config: Partial<AnnouncerConfig>): void => manager.configure(config);
/** Stop the announcer manager and remove its listeners; the next call starts it again. */
export const disposeAnnouncer = (): void => manager.dispose();
/** The announcer manager (get, configure, dispose). */
export const announcerManager = manager;
