// PermissionManager: the browser permission of each feature as a signal, and one request flow for all of them.
// Requests run only from a user action (a click); a permission tied to a consent category is not requested until the
// user agreed to that category (ConsentManager): request() then resolves "blocked" without a browser prompt.
//
//   import { permissions, configurePermissions } from "hadi-march/managers/permission";
//   configurePermissions({ consent: { geolocation: "preferences" } });
//   permissions().state("notifications")                  // "granted" | "denied" | "prompt" | "unsupported" (reactive)
//   await permissions().request("camera", { rationale: () => confirmDialog("…") })
//
// Events: permission:change ({ name, state }), permission:request ({ name }), permission:result ({ name, state }).
import { signal, type Signal } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";
import { consent, type ConsentCategory } from "../consent/index.ts";

export type PermissionKind =
  | "geolocation" | "notifications" | "camera" | "microphone" | "clipboard-read" | "clipboard-write"
  | "persistent-storage" | "screen-wake-lock" | "midi" | (string & {});
export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";
/** What request() ends with: a browser state, or "blocked" (consent missing / rationale declined). */
export type RequestResult = PermissionState | "blocked";

export interface PermissionConfig {
  /** Permission → consent category that must be granted before asking. Default: none. */
  consent: Partial<Record<string, ConsentCategory>>;
  /** Custom request flows (or overrides): return the resulting state. */
  requesters: Record<string, () => Promise<PermissionState>>;
}

export interface RequestOptions {
  /** Explain first (own dialog). false = do not show the browser prompt. Skipped when already granted / denied. */
  rationale?: () => boolean | Promise<boolean>;
}

export interface Permissions {
  /** Current state (reactive; queried on first read and followed through PermissionStatus.onchange). */
  state(name: PermissionKind): PermissionState;
  /** The feature exists in this browser. */
  supported(name: PermissionKind): boolean;
  /** The consent category this permission needs is granted (true when none is configured). */
  consented(name: PermissionKind): boolean;
  /** granted and consented: the app may use the feature now. */
  allowed(name: PermissionKind): boolean;
  /** A request is waiting for the user (reactive). */
  pending(name: PermissionKind): boolean;
  /** Ask the user. Call it from a click handler: browsers ignore or punish prompts without a user action. */
  request(name: PermissionKind, opts?: RequestOptions): Promise<RequestResult>;
  /** Query the browser again (after the user changed site settings). */
  refresh(name: PermissionKind): Promise<PermissionState>;
  dispose(): void;
}

const DEFAULTS: PermissionConfig = { consent: {}, requesters: {} };

type G = typeof globalThis & Record<string, unknown>;
type Nav = Navigator & Record<string, unknown> & { permissions?: { query(d: { name: string }): Promise<PermissionStatus> } };

const stopTracks = (s: MediaStream): void => { for (const t of s.getTracks()) t.stop(); };
const media = (c: MediaStreamConstraints) => async (): Promise<PermissionState> => {
  try { stopTracks(await navigator.mediaDevices.getUserMedia(c)); return "granted"; }
  catch (e) { return (e as Error).name === "NotAllowedError" ? "denied" : "prompt"; }
};
const fromNotification = (p: string): PermissionState => (p === "default" ? "prompt" : (p as PermissionState));

/** Built-in request flows: each shows the browser's own prompt. */
const BUILT_IN: Record<string, () => Promise<PermissionState>> = {
  geolocation: () => new Promise((res) => navigator.geolocation.getCurrentPosition(
    () => res("granted"), (e) => res(e.code === 1 ? "denied" : "granted"), { timeout: 15_000, maximumAge: 600_000 })),
  notifications: async () => fromNotification(await Notification.requestPermission()),
  camera: media({ video: true }),
  microphone: media({ audio: true }),
  "clipboard-read": async () => { try { await navigator.clipboard.readText(); return "granted"; } catch { return "denied"; } },
  "clipboard-write": async () => { try { await navigator.clipboard.writeText(""); return "granted"; } catch { return "denied"; } },
  "persistent-storage": async () => ((await navigator.storage.persist()) ? "granted" : "denied"),
  "screen-wake-lock": async () => { try { const l = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen"); await l.release(); return "granted"; } catch { return "denied"; } },
  midi: async () => { try { await (navigator as unknown as { requestMIDIAccess(): Promise<unknown> }).requestMIDIAccess(); return "granted"; } catch { return "denied"; } },
};

function exists(name: string): boolean {
  const g = globalThis as G, n = (g.navigator ?? {}) as Nav;
  switch (name) {
    case "geolocation": return "geolocation" in n;
    case "notifications": return "Notification" in g;
    case "camera": case "microphone": return !!(n["mediaDevices"] as MediaDevices | undefined)?.getUserMedia;
    case "clipboard-read": case "clipboard-write": return "clipboard" in n;
    case "persistent-storage": return !!(n["storage"] as StorageManager | undefined)?.persist;
    case "screen-wake-lock": return "wakeLock" in n;
    case "midi": return "requestMIDIAccess" in n;
    default: return !!n.permissions;
  }
}

function create(cfg: PermissionConfig): Permissions {
  const states = new Map<string, Signal<PermissionState>>();
  const pendings = new Map<string, Signal<boolean>>();
  const offs: (() => void)[] = [];
  const followed = new Set<string>();
  let alive = true;

  const set = (name: string, v: PermissionState): void => {
    const s = states.get(name);
    if (!s || s.peek() === v) return;
    s.set(v);
    emit("permission", "change", { name, state: v });
  };
  /** The Permissions API's answer, or null where it does not answer for this name. Follows changes once per name. */
  const fromApi = async (name: string): Promise<PermissionState | null> => {
    const nav = globalThis.navigator as Nav;
    if (!nav.permissions?.query) return null;
    try {
      const st = await nav.permissions.query({ name });
      if (alive && !followed.has(name)) {
        followed.add(name);
        const fn = (): void => set(name, st.state as PermissionState);
        st.addEventListener?.("change", fn);
        offs.push(() => st.removeEventListener?.("change", fn));
      }
      return st.state as PermissionState;
    } catch { return null; }
  };
  const query = async (name: string): Promise<PermissionState> => {
    if (!exists(name)) return "unsupported";
    const v = await fromApi(name);
    if (v) return v;
    if (name === "notifications") return fromNotification((globalThis as unknown as { Notification: { permission: string } }).Notification.permission);
    return "prompt";
  };
  const refresh = async (name: string): Promise<PermissionState> => { state(name); const v = await query(name); if (alive) set(name, v); return v; };
  const state = (name: string): PermissionState => {
    let s = states.get(name);
    if (!s) {
      states.set(name, (s = signal<PermissionState>(exists(name) ? "prompt" : "unsupported", { name: `permission.${name}` })));
      void refresh(name);
    }
    return s();
  };
  const pending = (name: string): Signal<boolean> => {
    let p = pendings.get(name);
    if (!p) pendings.set(name, (p = signal(false, { name: `permission.${name}.pending` })));
    return p;
  };
  const consented = (name: string): boolean => {
    const cat = cfg.consent[name];
    return !cat || consent.has(cat);
  };

  return {
    state,
    supported: exists,
    consented,
    allowed: (name) => state(name) === "granted" && consented(name),
    pending: (name) => pending(name)(),
    async request(name, opts = {}) {
      state(name);
      const now = states.get(name)!.peek();
      if (now === "unsupported") return now;
      if (!consented(name)) {
        emit("permission", "result", { name, state: "blocked", reason: "consent" });
        return "blocked";
      }
      if (now === "granted") return now;
      const p = pending(name);
      if (p.peek()) return now;
      emit("permission", "request", { name });
      p.set(true);
      try {
        if (now === "prompt" && opts.rationale && !(await opts.rationale())) {
          emit("permission", "result", { name, state: "blocked", reason: "rationale" });
          return "blocked";
        }
        const run = cfg.requesters[name] ?? BUILT_IN[name];
        const asked = run ? await run().catch((): PermissionState => "denied") : await query(name);
        // the Permissions API is the source of truth where it answers (a dismissed prompt stays "prompt")
        const v = (await fromApi(name)) ?? asked;
        if (alive) set(name, v);
        emit("permission", "result", { name, state: v });
        return v;
      } finally { p.set(false); }
    },
    refresh,
    dispose() { alive = false; for (const off of offs.splice(0)) off(); },
  };
}

const manager = defineManager<Permissions, PermissionConfig>("permission", create, DEFAULTS);
/** The permission manager (created on first call). */
export const permissions = (): Permissions => manager.get();
export const configurePermissions = (config: Partial<PermissionConfig>): void => manager.configure(config);
export const disposePermissions = (): void => manager.dispose();
export const permissionManager = manager;
