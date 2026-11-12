// PresenceManager: is the user here? One state from IdleManager, WindowManager and the connection:
// active (working in this app), idle (no input for a while), away (tab hidden), offline. The user's state across all
// open tabs is the most present one; other people (from a socket) are kept with setPeer().
//
//   import { presence, configurePresence } from "hadi-march/managers/presence";
//   configurePresence({ report: (state) => socket.send({ type: "presence", state }), heartbeat: 30_000 });
//   presence().state()   presence().overall()   presence().peers()      // reactive
//   socket.on("presence", (p) => presence().setPeer(p.userId, p.state, { name: p.name }))
//
// Events: presence:change ({ state, overall }), presence:peer ({ id, state }).
import { signal, computed, effect, untrack } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";
import { idle } from "../idle/index.ts";
import { appWindow } from "../window/index.ts";

export type PresenceState = "active" | "idle" | "away" | "offline";
/** Someone else's presence (from the server), or another tab of this app. */
export interface Peer { id: string; state: PresenceState; since: number; meta?: Record<string, unknown> }

export interface PresenceConfig {
  /** Send the state to the server (socket / net). Called on every change of overall() and every `heartbeat`. */
  report: ((state: PresenceState, info: { tab: string; since: number }) => void) | null;
  /** ms between repeated reports while nothing changes (0 = only on change). Default 30 000. */
  heartbeat: number;
  /** Share the state with the other tabs (WindowManager). Default true. */
  shareTabs: boolean;
}

export interface Presence {
  /** This tab (reactive). */
  state(): PresenceState;
  /** When the state last changed. */
  since(): number;
  /** The user across every open tab: the most present one wins. */
  overall(): PresenceState;
  /** The other tabs of this app and their state (reactive). */
  tabs(): Peer[];
  /** People reported by the server (reactive). */
  peers(): Peer[];
  setPeer(id: string, state: PresenceState, meta?: Record<string, unknown>): void;
  removePeer(id: string): void;
  dispose(): void;
}

const RANK: Record<PresenceState, number> = { active: 3, idle: 2, away: 1, offline: 0 };
const DEFAULTS: PresenceConfig = { report: null, heartbeat: 30_000, shareTabs: true };

function create(cfg: PresenceConfig): Presence {
  const win = globalThis as unknown as EventTarget;
  const online = signal(globalThis.navigator?.onLine !== false, { name: "presence.online" });
  const setOnline = (): void => { online.set(globalThis.navigator?.onLine !== false); };
  win.addEventListener?.("online", setOnline);
  win.addEventListener?.("offline", setOnline);

  const w = appWindow();
  // read through the managers: a re-configured Idle / Window is followed
  const state = computed<PresenceState>(() => (!online() ? "offline" : !appWindow().visible() ? "away" : idle().idle() ? "idle" : "active"));
  const since = signal(Date.now(), { name: "presence.since" });
  const tabStates = signal<Record<string, Peer>>({}, { name: "presence.tabs" });
  const peers = signal<Record<string, Peer>>({}, { name: "presence.peers" });

  const tabs = computed(() => {
    const live = new Set(appWindow().tabs().map((t) => t.id));
    return Object.values(tabStates()).filter((p) => live.has(p.id));
  });
  const overall = computed<PresenceState>(() => {
    let best = state();
    for (const p of tabs()) if (RANK[p.state] > RANK[best]) best = p.state;
    return best;
  });

  const offMsg = w.on("presence", (data, from) => {
    const s = data as PresenceState;
    if (!(s in RANK)) return;
    tabStates.update((m) => ({ ...m, [from]: { id: from, state: s, since: Date.now() } }));
  });
  // a new tab asks; everyone answers with their state
  const offAsk = w.on("presence?", () => w.broadcast("presence", untrack(state)));

  const report = (): void => { try { cfg.report?.(untrack(overall), { tab: w.id, since: since.peek() }); } catch (e) { console.error(e); } };
  let first = true;
  const stopState = effect(() => {
    const s = state();
    untrack(() => {
      if (first) { first = false; if (cfg.shareTabs) { w.broadcast("presence", s); w.broadcast("presence?"); } return; }
      since.set(Date.now());
      if (cfg.shareTabs) w.broadcast("presence", s);
    });
  });
  let firstOverall = true;
  const stopOverall = effect(() => {
    const o = overall();
    untrack(() => {
      if (firstOverall) { firstOverall = false; report(); return; }
      emit("presence", "change", { state: state(), overall: o });
      report();
    });
  });
  const beat = cfg.heartbeat > 0 && cfg.report ? setInterval(report, cfg.heartbeat) : null;

  return {
    state,
    since,
    overall,
    tabs,
    peers: () => Object.values(peers()),
    setPeer(id, s, meta) {
      peers.update((m) => ({ ...m, [id]: { id, state: s, since: m[id]?.state === s ? m[id]!.since : Date.now(), ...(meta ? { meta } : {}) } }));
      emit("presence", "peer", { id, state: s });
    },
    removePeer(id) { peers.update((m) => { const { [id]: _gone, ...rest } = m; return rest; }); },
    dispose() {
      stopState(); stopOverall(); offMsg(); offAsk();
      if (beat) clearInterval(beat);
      win.removeEventListener?.("online", setOnline);
      win.removeEventListener?.("offline", setOnline);
    },
  };
}

const manager = defineManager<Presence, PresenceConfig>("presence", create, DEFAULTS);
/** The presence manager (created on first call; starts Idle and Window). */
export const presence = (): Presence => manager.get();
export const configurePresence = (config: Partial<PresenceConfig>): void => manager.configure(config);
export const disposePresence = (): void => manager.dispose();
export const presenceManager = manager;
