// ConfigManager: the app's settings in layers — defaults < environment < remote < runtime overrides — read by dotted
// path, reactive, with the layer each value came from and an optional check.
//
//   import { appConfig, configureAppConfig } from "hadi-march/managers/config";
//   configureAppConfig({ defaults: { api: { baseUrl: "/api", timeout: 30000 }, ui: { density: "comfortable" } } });
//   const c = appConfig();
//   c.get("api.baseUrl")            // reactive; "/api" until a higher layer sets it
//   await c.load(() => net.get("/config.json"))   // remote layer
//   c.set("ui.density", "compact")  // override layer;  c.reset("ui.density")
//   c.source("api.baseUrl")         // "default" | "env" | "remote" | "override"
// The environment layer reads <meta name="m-config" content='{"api":{"baseUrl":"…"}}'> (CSP friendly, no inline script).
import { signal, computed, type Accessor } from "../../core/reactive.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

export type Layer = "default" | "env" | "remote" | "override";
export type ConfigTree = Record<string, unknown>;

export interface AppConfigOptions {
  defaults: ConfigTree;
  /** Environment layer. Default: JSON in <meta name="m-config">. */
  env: ConfigTree | (() => ConfigTree) | null;
  /** Check the merged config; return error messages (shown by errors(), the layer is still applied). */
  validate: ((cfg: ConfigTree) => string[]) | null;
}

export interface AppConfig {
  /** Value at a dotted path (reactive). */
  get<T = unknown>(path: string, fallback?: T): T;
  /** The whole merged config (reactive). */
  all: Accessor<ConfigTree>;
  /** Set a runtime override. */
  set(path: string, value: unknown): void;
  /** Remove an override (the whole override layer without a path). */
  reset(path?: string): void;
  /** Load the remote layer (replaces the previous one). Errors are reported and rethrown. */
  load(fetcher: () => ConfigTree | Promise<ConfigTree>): Promise<void>;
  /** Which layer the value at `path` comes from. */
  source(path: string): Layer | undefined;
  /** Leaf paths of the merged config. */
  paths(): string[];
  /** Messages from validate(). */
  errors: Accessor<string[]>;
  dispose(): void;
}

const pub = publisher("config");
const isObj = (v: unknown): v is ConfigTree => !!v && typeof v === "object" && !Array.isArray(v);

function merge(a: ConfigTree, b: ConfigTree): ConfigTree {
  const out: ConfigTree = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k] as ConfigTree, v) : v;
  return out;
}
function at(tree: unknown, path: string): unknown {
  let cur = tree;
  for (const p of path.split(".")) { if (!isObj(cur) || !(p in cur)) return undefined; cur = cur[p]; }
  return cur;
}
function put(tree: ConfigTree, path: string, value: unknown): ConfigTree {
  const [head, ...rest] = path.split(".") as [string, ...string[]];
  if (!rest.length) { const o = { ...tree }; if (value === undefined) delete o[head]; else o[head] = value; return o; }
  return { ...tree, [head]: put(isObj(tree[head]) ? tree[head] as ConfigTree : {}, rest.join("."), value) };
}
function leaves(tree: ConfigTree, pre = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (isObj(v) ? leaves(v, `${pre}${k}.`) : [pre + k]));
}
function readMeta(): ConfigTree {
  try {
    const m = globalThis.document?.querySelector('meta[name="m-config"]')?.getAttribute("content");
    return m ? JSON.parse(m) as ConfigTree : {};
  } catch { return {}; }
}

function create(opts: AppConfigOptions): AppConfig {
  const env = typeof opts.env === "function" ? opts.env() : opts.env ?? readMeta();
  const remote = signal<ConfigTree>({}, { name: "config.remote" });
  const override = signal<ConfigTree>({}, { name: "config.override" });
  const layers = (): [Layer, ConfigTree][] => [["override", override()], ["remote", remote()], ["env", env], ["default", opts.defaults]];
  const all = computed(() => merge(merge(merge(opts.defaults, env), remote()), override()));
  const errors = computed(() => (opts.validate ? opts.validate(all()) : []));
  return {
    get: <T>(path: string, fallback?: T): T => { const v = at(all(), path); return (v === undefined ? fallback : v) as T; },
    all,
    set(path, value) { override.update((o) => put(o, path, value)); pub("change", { path, value, layer: "override" }); },
    reset(path) {
      override.update((o) => (path ? put(o, path, undefined) : {}));
      pub("change", { path: path ?? "*", layer: "override", reset: true });
    },
    async load(fetcher) {
      try {
        const data = await fetcher();
        remote.set(isObj(data) ? data : {});
        pub("load", { paths: leaves(isObj(data) ? data : {}).length });
      } catch (error) { pub("error", { error }); throw error; }
    },
    source(path) { for (const [name, tree] of layers()) if (at(tree, path) !== undefined) return name; return undefined; },
    paths: () => leaves(all()),
    errors,
    dispose() { /* nothing to remove */ },
  };
}

const manager = defineManager<AppConfig, AppConfigOptions>("config", create, { defaults: {}, env: null, validate: null });

/** The app config (created on first call). */
export const appConfig = (): AppConfig => manager.get();
/** Set defaults, the environment source or the check. The remote and override layers start empty again. */
export const configureAppConfig = (config: Partial<AppConfigOptions>): void => manager.configure(config);
/** Stop the config manager and remove its listeners; the next call starts it again. */
export const disposeAppConfig = (): void => manager.dispose();
/** The config manager (get, configure, dispose). */
export const configManager = manager;
