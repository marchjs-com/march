// FeatureFlagManager: turn features on and off without a release — fixed values, gradual rollout by a stable user
// hash, A/B variants, conditions, remote values and local overrides (kept across reloads, for testing).
//
//   import { flags, configureFlags } from "march/managers/flags";
//   configureFlags({
//     user: () => session.id,
//     flags: {
//       newCheckout: { percent: 25 },                      // 25 % of users, the same ones every time
//       darkCharts: true,
//       searchV2: { when: () => can("beta") },
//       pricing: { variants: { control: 50, annual: 50 } },
//     },
//   });
//   flags().on("newCheckout")   flags().variant("pricing")   flags().override("darkCharts", false)
//   flags().load(await net.get("/flags"))                  // remote values win over the rules
//   <section feature:newCheckout>…</section>   <p feature:newCheckout={false}>Old checkout</p>
import { signal, computed, effect, untrack, type Accessor } from "../../core/reactive.ts";
import { registerNamespace } from "../../dom/props.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";
import { storage } from "../storage/index.ts";

export type FlagValue = boolean | string;
export type FlagRule =
  | boolean
  | { percent: number; salt?: string }
  | { when: () => boolean }
  | { variants: Record<string, number>; salt?: string };
export type FlagSource = "rule" | "remote" | "override";

export interface FlagsConfig {
  flags: Record<string, FlagRule>;
  /** Stable id for rollouts and variants. Default: a random id kept in local storage. */
  user: (() => string) | null;
  /** Storage key for local overrides (null = not kept). Default "flags.override". */
  overrideKey: string | null;
}

export interface FlagInfo { name: string; value: FlagValue; source: FlagSource; rule: string }

export interface Flags {
  /** The flag is on (a variant other than "off" / "control" counts as on). Reactive. */
  on(name: string): boolean;
  /** The flag's value: true / false, or the variant name. Reactive. */
  value(name: string): FlagValue;
  /** The variant of an A/B flag. */
  variant(name: string): string;
  /** Force a value on this device (null removes the override). */
  override(name: string, value: FlagValue | null): void;
  clearOverrides(): void;
  /** Remote values (win over the rules, lose to overrides). */
  load(values: Record<string, FlagValue>): void;
  /** Every flag with value and source (reactive). */
  list: Accessor<FlagInfo[]>;
  /** The id used for rollouts. */
  user(): string;
  dispose(): void;
}

const pub = publisher("flags");

/** FNV-1a → 0..99: the same id and flag always land in the same bucket. */
export function bucket(id: string, salt: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${salt}:${id}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 100;
}

function describe(r: FlagRule): string {
  if (typeof r === "boolean") return r ? "on" : "off";
  if ("percent" in r) return `${r.percent}%`;
  if ("variants" in r) return Object.entries(r.variants).map(([k, v]) => `${k} ${v}%`).join(" / ");
  return "when()";
}

function create(cfg: FlagsConfig): Flags {
  const local = storage().local;
  const user = cfg.user ?? ((): string => {
    let id = local.getSync<string>("flags.user");
    if (!id) { id = Math.random().toString(36).slice(2, 10); local.setSync("flags.user", id); }
    return id;
  });
  const overrides = signal<Record<string, FlagValue>>(cfg.overrideKey ? local.getSync(cfg.overrideKey, {}) ?? {} : {}, { name: "flags.override" });
  const remote = signal<Record<string, FlagValue>>({}, { name: "flags.remote" });
  const seen = new Set<string>();

  const evaluate = (name: string): FlagValue => {
    const r = cfg.flags[name];
    if (r === undefined) return false;
    if (typeof r === "boolean") return r;
    if ("when" in r) return !!r.when();
    if ("percent" in r) return bucket(user(), r.salt ?? name) < r.percent;
    let n = bucket(user(), r.salt ?? name);
    for (const [k, w] of Object.entries(r.variants)) { if (n < w) return k; n -= w; }
    return Object.keys(r.variants)[0] ?? false;
  };
  const resolve = (name: string): [FlagValue, FlagSource] => {
    const o = overrides()[name];
    if (o !== undefined) return [o, "override"];
    const rv = remote()[name];
    if (rv !== undefined) return [rv, "remote"];
    return [evaluate(name), "rule"];
  };
  const value = (name: string): FlagValue => {
    const [v, source] = resolve(name);
    if (!seen.has(name)) { seen.add(name); untrack(() => pub("exposure", { name, value: v, source })); } // first use: analytics
    return v;
  };
  const save = (o: Record<string, FlagValue>): void => { if (cfg.overrideKey) local.setSync(cfg.overrideKey, o); };

  return {
    on: (name) => { const v = value(name); return v === true || (typeof v === "string" && v !== "off" && v !== "control"); },
    value,
    variant: (name) => String(value(name)),
    override(name, v) {
      overrides.update((o) => { const n = { ...o }; if (v === null) delete n[name]; else n[name] = v; save(n); return n; });
      pub("change", { name, value: v, source: "override" });
    },
    clearOverrides() { overrides.set({}); save({}); pub("change", { name: "*", source: "override" }); },
    load(values) { remote.set({ ...values }); pub("load", { count: Object.keys(values).length }); },
    list: computed(() => {
      const names = new Set([...Object.keys(cfg.flags), ...Object.keys(remote()), ...Object.keys(overrides())]);
      return [...names].map((name) => { const [v, source] = resolve(name); const r = cfg.flags[name]; return { name, value: v, source, rule: r === undefined ? "—" : describe(r) }; });
    }),
    user,
    dispose() { /* nothing to remove */ },
  };
}

const manager = defineManager<Flags, FlagsConfig>("flags", create, { flags: {}, user: null, overrideKey: "flags.override" });

/** The feature flags (created on first call). */
export const flags = (): Flags => manager.get();
/** Set the feature flag manager's options (merged into the current config). */
export const configureFlags = (config: Partial<FlagsConfig>): void => manager.configure(config);
/** Stop the feature flag manager and remove its listeners; the next call starts it again. */
export const disposeFlags = (): void => manager.dispose();
/** The feature flag manager (get, configure, dispose). */
export const flagsManager = manager;

// feature:name — show the element only while the flag is on; feature:name={false} only while it is off;
// feature:name="annual" only for that variant.
registerNamespace("feature", (el, name, want) => {
  effect(() => {
    const w = typeof want === "function" ? (want as () => unknown)() : want;
    const v = flags().value(name);
    const show = typeof w === "string" ? v === w : flags().on(name) === (w !== false);
    (el as HTMLElement).hidden = !show;
  });
});
