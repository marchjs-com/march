// WindowManager: this tab's visibility and focus, and the other open tabs of the app (BroadcastChannel): how many,
// which one leads (runs the poller, owns the socket), and messages between them.
//
//   import { appWindow } from "hadi-march/managers/window";
//   const w = appWindow();
//   w.visible()  w.focused()  w.count()  w.leader()  w.tabs()          // reactive
//   w.broadcast("cart", { count: 3 });   w.on("cart", (data, from) => …)
//
// Events: window:visible, window:hidden, window:focus, window:blur, window:tabs ({ count }), window:leader ({ leader }),
// window:message ({ type, from }).
import { signal, onCleanup, getOwner } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";

export interface WindowConfig {
  /** BroadcastChannel name (one per app). */
  channel: string;
  /** ms between "I am here" messages. Default 2000. */
  heartbeat: number;
  /** A tab silent for this long is gone (crashed, frozen). Default 3 heartbeats. */
  ttl: number;
}

/** One open tab of the app. */
export interface TabInfo { id: string; since: number; visible: boolean; focused: boolean; self: boolean }

export interface AppWindow {
  /** This tab's id (random, per page load). */
  readonly id: string;
  visible(): boolean;
  focused(): boolean;
  /** Every open tab of the app, this one included, oldest first (reactive). */
  tabs(): TabInfo[];
  count(): number;
  /** This tab is the oldest open tab: the one that should run shared work. */
  leader(): boolean;
  /** Send a message to the other tabs (structured-cloneable data). */
  broadcast(type: string, data?: unknown): void;
  /** Messages from other tabs; inside a component the listener goes with it. */
  on(type: string, fn: (data: unknown, from: string) => void): () => void;
  dispose(): void;
}

const DEFAULTS: WindowConfig = { channel: "hadi-march:window", heartbeat: 2000, ttl: 6000 };

type Wire = { k: "hello" | "ping" | "bye" | "msg"; from: string; since: number; visible: boolean; focused: boolean; type?: string; data?: unknown };

function create(cfg: WindowConfig): AppWindow {
  const doc = globalThis.document as (Document & EventTarget) | undefined;
  const win = globalThis as unknown as EventTarget;
  const id = Math.random().toString(36).slice(2, 10);
  const since = Date.now();
  const visible = signal(doc?.visibilityState !== "hidden", { name: "window.visible" });
  const focused = signal(typeof doc?.hasFocus === "function" ? doc.hasFocus() : true, { name: "window.focused" });
  const others = new Map<string, TabInfo & { seen: number }>();
  const tabs = signal<TabInfo[]>([], { name: "window.tabs" });
  const leader = signal(true, { name: "window.leader" });
  const handlers = new Map<string, Set<(data: unknown, from: string) => void>>();
  const BC = (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
  const bc = BC ? new BC(cfg.channel) : null;

  const self = (): TabInfo => ({ id, since, visible: visible.peek(), focused: focused.peek(), self: true });
  const order = (a: TabInfo, b: TabInfo): number => a.since - b.since || (a.id < b.id ? -1 : 1);
  const publish = (): void => {
    const list = [self(), ...[...others.values()].map(({ seen: _s, ...t }) => t)].sort(order);
    const prevCount = tabs.peek().length;
    tabs.set(list);
    if (list.length !== prevCount) emit("window", "tabs", { count: list.length });
    const lead = list[0]?.id === id;
    if (lead !== leader.peek()) { leader.set(lead); emit("window", "leader", { leader: lead }); }
  };
  const send = (k: Wire["k"], extra: Partial<Wire> = {}): void => {
    try { bc?.postMessage({ k, from: id, since, visible: visible.peek(), focused: focused.peek(), ...extra }); } catch (e) { console.error(e); }
  };
  const receive = (ev: MessageEvent): void => {
    const m = ev.data as Wire;
    if (!m || typeof m.from !== "string" || m.from === id) return;
    if (m.k === "bye") { if (others.delete(m.from)) publish(); return; }
    const known = others.has(m.from);
    others.set(m.from, { id: m.from, since: m.since, visible: m.visible, focused: m.focused, self: false, seen: Date.now() });
    if (m.k === "hello" && !known) send("ping");
    if (m.k === "msg" && m.type) {
      emit("window", "message", { type: m.type, from: m.from });
      for (const f of [...(handlers.get(m.type) ?? [])]) { try { f(m.data, m.from); } catch (e) { console.error(e); } }
    }
    publish();
  };
  if (bc) bc.onmessage = receive;
  const beat = setInterval(() => {
    const now = Date.now();
    let gone = false;
    for (const [k, t] of others) if (now - t.seen > cfg.ttl) { others.delete(k); gone = true; }
    send("ping");
    if (gone) publish();
  }, cfg.heartbeat);

  const onVisibility = (): void => {
    const v = doc?.visibilityState !== "hidden";
    if (v === visible.peek()) return;
    visible.set(v);
    emit("window", v ? "visible" : "hidden");
    send("ping");
    publish();
  };
  const onFocus = (f: boolean) => (): void => {
    if (f === focused.peek()) return;
    focused.set(f);
    emit("window", f ? "focus" : "blur");
    send("ping");
    publish();
  };
  const focusIn = onFocus(true), focusOut = onFocus(false);
  const bye = (): void => send("bye");
  doc?.addEventListener("visibilitychange", onVisibility);
  win.addEventListener?.("focus", focusIn);
  win.addEventListener?.("blur", focusOut);
  win.addEventListener?.("pagehide", bye);
  publish();
  send("hello");

  return {
    id,
    visible,
    focused,
    tabs,
    count: () => tabs().length,
    leader,
    broadcast: (type, data) => send("msg", { type, data }),
    on(type, fn) {
      let s = handlers.get(type);
      if (!s) handlers.set(type, (s = new Set()));
      s.add(fn);
      const off = (): void => { s.delete(fn); };
      if (getOwner()) onCleanup(off);
      return off;
    },
    dispose() {
      clearInterval(beat);
      bye();
      bc?.close();
      doc?.removeEventListener("visibilitychange", onVisibility);
      win.removeEventListener?.("focus", focusIn);
      win.removeEventListener?.("blur", focusOut);
      win.removeEventListener?.("pagehide", bye);
      handlers.clear();
      others.clear();
    },
  };
}

const manager = defineManager<AppWindow, WindowConfig>("window", create, DEFAULTS);
/** The window manager (created on first call). */
export const appWindow = (): AppWindow => manager.get();
export const configureWindow = (config: Partial<WindowConfig>): void => manager.configure(config);
export const disposeWindow = (): void => manager.dispose();
export const windowManager = manager;
