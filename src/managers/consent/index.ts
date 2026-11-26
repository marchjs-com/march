// ConsentManager: cookie and KVKK / GDPR consent — categories, a versioned and dated record kept in storage, gates that
// keep analytics, log shipping and third-party code off until the user agrees, and withdrawal.
//
//   import { consent, configureConsent } from "march/managers/consent";
//   configureConsent({ version: "2026-11" });            // a new version asks everyone again
//   consent.has("analytics")                               // reactive
//   consent.on("analytics", (granted) => …)                // state of one category changed ("change" = any)
//   const track = consent.gate("analytics", send)          // runs `send` only while analytics is granted
//   consent.whenGranted("thirdParty", () => loadMap())     // runs now or once granted; its cleanup runs on withdrawal
//   <div consent:thirdParty>…</div>  <p consent:thirdParty={false}>…</p>   (embeds: <ConsentGate> from ./ui)
//
// The banner and the preferences panel are a separate, lazy module: march/managers/consent/ui.
// Legal texts belong to the app; March gives the frame (categories, record, gates, UI).
import { signal, computed, effect, untrack, getOwner, runWithOwner, onCleanup, DEV } from "../../core/reactive.ts";
import { registerNamespace } from "../../dom/props.ts";
import { defineManager, emit } from "../manager.ts";

/** Built-in categories. Apps may add their own ids. */
export type ConsentCategory = "necessary" | "preferences" | "analytics" | "marketing" | "thirdParty";
type CategoryId = ConsentCategory | (string & {});

export interface CategoryInfo {
  id: CategoryId;
  /** Title and description: English source text, translated with t() by the UI. */
  title: string;
  description: string;
  /** Always on, cannot be refused (strictly necessary). */
  required?: boolean;
}

/** How the user decided. */
export type ConsentMethod = "all" | "none" | "custom";
/** What is stored: which categories, which policy version, when, and how. */
export interface ConsentRecord {
  version: string;
  /** ISO date of the decision. */
  date: string;
  choices: Record<string, boolean>;
  method: ConsentMethod;
}

interface KeyStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export interface ConsentConfig {
  /** Policy version. A stored record with another version counts as undecided (the banner shows again). */
  version: string;
  categories: CategoryInfo[];
  /** Storage key. Default "m.consent". */
  storageKey: string;
  /** Where the record lives. Default localStorage; null keeps it in memory only. */
  storage: KeyStore | null | undefined;
  /** A record older than this many days counts as undecided. Default 365. */
  maxAgeDays: number;
  /** Link to the app's privacy / cookie policy, shown by the UI. */
  policyHref: string | null;
}

/** The default consent categories: necessary, preferences, analytics, marketing. */
export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { id: "necessary", title: "Strictly necessary", description: "Needed for the site to work: sign-in, security, your consent choice. Always on.", required: true },
  { id: "preferences", title: "Preferences", description: "Remember settings such as language, theme and layout." },
  { id: "analytics", title: "Analytics", description: "Anonymous usage statistics and error reports that help us improve the product." },
  { id: "marketing", title: "Marketing", description: "Personalized content and advertising, measured across sites." },
  { id: "thirdParty", title: "Third-party content", description: "Embedded maps, videos and widgets from other providers, which may set their own cookies." },
];

const DEFAULTS: ConsentConfig = {
  version: "1",
  categories: DEFAULT_CATEGORIES,
  storageKey: "m.consent",
  storage: undefined,
  maxAgeDays: 365,
  policyHref: null,
};

export type ConsentListener = (granted: boolean, record: ConsentRecord | null) => void;

export interface Consent {
  /** Is this category granted? Reactive. Required categories are always true. */
  has(category: CategoryId): boolean;
  /** Has the user decided for the current version (and the record is not expired)? Reactive. */
  decided(): boolean;
  /** The valid record, or null. Reactive. */
  record(): ConsentRecord | null;
  /** Current state of every category. Reactive. */
  choices(): Record<string, boolean>;
  categories(): CategoryInfo[];
  policyHref(): string | null;
  acceptAll(): ConsentRecord;
  rejectAll(): ConsentRecord;
  /** Save a custom choice (missing categories are refused; required ones are on). */
  save(choices: Record<string, boolean>): ConsentRecord;
  /** Withdraw consent: the record is removed, every optional category is off, the banner shows again. */
  withdraw(): void;
  /** Call `fn(granted, record)` when a category's state changes ("change": on every decision). Returns off. */
  on(category: CategoryId | "change", fn: ConsentListener): () => void;
  /** Wrap `fn` so it runs only while `category` is granted (otherwise returns undefined). */
  gate<A extends unknown[], R>(category: CategoryId, fn: (...args: A) => R): (...args: A) => R | undefined;
  /** Run `start` now if granted, or as soon as it is; the cleanup it returns runs when consent is taken back. Returns off. */
  whenGranted(category: CategoryId, start: () => (() => void) | void): () => void;
  /** Resolves once the category is granted. */
  granted(category: CategoryId): Promise<void>;
  dispose(): void;
}

const storageOf = (c: ConsentConfig): KeyStore | null => {
  if (c.storage !== undefined) return c.storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

function create(cfg: ConsentConfig): Consent {
  const store = storageOf(cfg);
  const ids = new Set(cfg.categories.map((c) => c.id));
  const required = new Set(cfg.categories.filter((c) => c.required).map((c) => c.id));
  const valid = (r: unknown): r is ConsentRecord => {
    const x = r as ConsentRecord | null;
    if (!x || typeof x !== "object" || x.version !== cfg.version || typeof x.choices !== "object") return false;
    const t = Date.parse(x.date);
    return Number.isFinite(t) && Date.now() - t <= cfg.maxAgeDays * 864e5;
  };
  const load = (): ConsentRecord | null => {
    try { const r = JSON.parse(store?.getItem(cfg.storageKey) ?? "null"); return valid(r) ? r : null; } catch { return null; }
  };
  const rec = signal<ConsentRecord | null>(load(), { name: "consent.record" });
  const stateOf = (r: ConsentRecord | null): Record<string, boolean> => {
    const o: Record<string, boolean> = {};
    for (const id of ids) o[id] = required.has(id) || !!r?.choices[id];
    return o;
  };
  const listeners = new Set<{ cat: string; fn: ConsentListener }>();
  const offs: (() => void)[] = [];

  // apply a new record: store it, update the signal, tell listeners whose category changed
  const apply = (next: ConsentRecord | null, persist: boolean): void => {
    const before = stateOf(rec.peek());
    if (persist) {
      try { next ? store?.setItem(cfg.storageKey, JSON.stringify(next)) : store?.removeItem(cfg.storageKey); } catch { /* storage blocked: memory only */ }
    }
    rec.set(next);
    const after = stateOf(next);
    for (const l of [...listeners]) {
      if (l.cat === "change") l.fn(true, next);
      else if (before[l.cat] !== after[l.cat]) l.fn(!!after[l.cat], next);
    }
    emit("consent", next ? "change" : "withdraw", { choices: after, method: next?.method ?? null, version: cfg.version });
  };
  const decide = (choices: Record<string, boolean>, method: ConsentMethod): ConsentRecord => {
    const c: Record<string, boolean> = {};
    for (const id of ids) c[id] = required.has(id) || !!choices[id];
    const r: ConsentRecord = { version: cfg.version, date: new Date().toISOString(), choices: c, method };
    apply(r, true);
    return r;
  };
  const all = (v: boolean): Record<string, boolean> => Object.fromEntries([...ids].map((id) => [id, v]));

  // another tab decided or withdrew
  const onStorage = (e: Event): void => { if ((e as StorageEvent).key === cfg.storageKey) apply(load(), false); };
  globalThis.addEventListener?.("storage", onStorage);
  offs.push(() => globalThis.removeEventListener?.("storage", onStorage));

  const known = (cat: string): boolean => {
    if (ids.has(cat)) return true;
    if (DEV.enabled) DEV.warn(`consent: unknown category "${cat}" (${[...ids].join(", ")}); treated as not granted.`);
    return false;
  };
  // one computed per category: bindings re-run only when that category flips, not on every decision
  const memo = new Map<string, () => boolean>();
  const root = getOwner(); // the manager's own root: memos must not belong to the binding that asked first
  const has = (cat: string): boolean => {
    if (required.has(cat)) return true;
    let f = memo.get(cat);
    if (!f) { if (!known(cat)) return false; f = runWithOwner(root, () => untrack(() => computed(() => !!rec()?.choices[cat]))); memo.set(cat, f); }
    return f();
  };
  const on = (cat: string, fn: ConsentListener): (() => void) => {
    const l = { cat, fn };
    listeners.add(l);
    const off = (): void => { listeners.delete(l); };
    if (getOwner()) onCleanup(off);
    return off;
  };

  return {
    has,
    decided: () => rec() !== null,
    record: () => rec(),
    choices: () => stateOf(rec()),
    categories: () => cfg.categories,
    policyHref: () => cfg.policyHref,
    acceptAll: () => decide(all(true), "all"),
    rejectAll: () => decide(all(false), "none"),
    save: (choices) => decide(choices, "custom"),
    withdraw: () => apply(null, true),
    on,
    gate: (cat, fn) => (...args) => (untrack(() => has(cat)) ? fn(...args) : undefined),
    whenGranted(cat, start) {
      let stop: (() => void) | void;
      const run = (g: boolean): void => {
        if (g && !stop) stop = start() ?? (() => {});
        else if (!g && stop) { const s = stop; stop = undefined; s(); }
      };
      const off = on(cat, (g) => run(g));
      run(untrack(() => has(cat)));
      return () => { off(); run(false); };
    },
    granted: (cat) => new Promise((resolve) => {
      if (untrack(() => has(cat))) return resolve();
      const off = on(cat, (g) => { if (g) { off(); resolve(); } });
    }),
    dispose() {
      for (const off of offs.splice(0)) off();
      listeners.clear();
    },
  };
}

const manager = defineManager<Consent, ConsentConfig>("consent", create, DEFAULTS);

/** The consent manager. Every method goes to the one instance (created on first use). */
export const consent: Consent = {
  has: (c) => manager.get().has(c),
  decided: () => manager.get().decided(),
  record: () => manager.get().record(),
  choices: () => manager.get().choices(),
  categories: () => manager.get().categories(),
  policyHref: () => manager.get().policyHref(),
  acceptAll: () => manager.get().acceptAll(),
  rejectAll: () => manager.get().rejectAll(),
  save: (c) => manager.get().save(c),
  withdraw: () => manager.get().withdraw(),
  on: (c, fn) => manager.get().on(c, fn),
  gate: (c, fn) => (...a) => manager.get().gate(c, fn)(...a),
  whenGranted: (c, s) => manager.get().whenGranted(c, s),
  granted: (c) => manager.get().granted(c),
  dispose: () => manager.dispose(),
};
/** Global options: policy version, categories, storage, max age, policy link. */
export const configureConsent = (config: Partial<ConsentConfig>): void => manager.configure(config);
/** Shut the consent manager down; the next use starts it again. */
export const disposeConsent = (): void => manager.dispose();
/** The consent manager (get, configure, dispose). */
export const consentManager = manager;

// consent:category — show the element only while granted; consent:category={false} shows it only while refused.
registerNamespace("consent", (el, name, value) => {
  effect(() => {
    const want = typeof value === "function" ? (value as () => unknown)() : value;
    (el as HTMLElement).hidden = consent.has(name) !== (want !== false);
  });
});
