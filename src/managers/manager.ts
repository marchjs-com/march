// The manager pattern: one instance per app, created on first use (lazy), configured globally, shut down with dispose.
//
//   const vp = defineManager("viewport", (config: ViewportConfig) => createViewport(config), {});
//   vp.get()          // the instance (created now if needed)
//   vp.configure({…}) // merge config; a live instance is disposed and re-created on next use
//   vp.dispose()      // remove listeners, forget the instance
//
// Bindings that read through get() follow a re-configured instance: get() tracks a version signal.
//
// Events go through channels (src/channel), not a callback: emit(manager, type, detail) publishes to
//   "managers"            every event, topic "<manager>:<type>" (the last 50 replay for late listeners and devtools)
//   "managers.<manager>"  that manager's events, payload { type, detail }
// Listen with onManager("session:*", fn), managerChannelOf("undo").on(fn) or onChannels("managers.*", fn); nothing
// has to be connected first, and any number of listeners can follow (docs/architecture.md).

import { signal, untrack, createRoot } from "../core/reactive.ts";
import { channel, type Channel } from "../channel/index.ts";

/** One event a manager reports, e.g. { manager: "consent", type: "change", detail: { analytics: true } }. */
export interface ManagerEvent { manager: string; type: string; detail?: unknown }
/** A manager event on the `managers` channel. */
export interface ManagerMessage extends ManagerEvent { topic: string; at: number }
/** One event on a manager's own channel ("managers.<name>"). */
export interface ManagerChannelMessage<D = unknown> { type: string; detail?: D }

/** The `managers` channel: every manager event with the topic `<manager>:<type>` (keeps the last 50 for late listeners). */
export const managerChannel: Channel<ManagerMessage> = channel<ManagerMessage>("managers", { replay: 50 });
const own = new Map<string, Channel<ManagerChannelMessage>>();
/** The channel one manager publishes to ("managers.<name>"). */
export const managerChannelOf = (name: string): Channel<ManagerChannelMessage> => {
  let ch = own.get(name);
  if (!ch) own.set(name, (ch = channel<ManagerChannelMessage>(`managers.${name}`)));
  return ch;
};

/** Report an event from a manager on its channels. A failing listener never throws into the manager. */
export function emit(manager: string, type: string, detail?: unknown): void {
  try {
    managerChannel.emit({ manager, type, detail, topic: `${manager}:${type}`, at: Date.now() });
    managerChannelOf(manager).emit(detail === undefined ? { type } : { type, detail });
  } catch (e) { console.error(e); }
}

const matches = (pattern: string, topic: string): boolean =>
  pattern === "*" || (pattern.endsWith("*") ? topic.startsWith(pattern.slice(0, -1)) : topic === pattern);
/** Listen to manager events by topic: "idle:idle", "session:*", "*". Returns off (removed with the owning component).
 *  Replayed messages are skipped unless `replay` is true. */
export function onManager(pattern: string, fn: (m: ManagerMessage) => void, opts: { replay?: boolean } = {}): () => void {
  return managerChannel.on((m) => { if (matches(pattern, m.topic)) fn(m); }, { replay: opts.replay ?? false });
}

/** An instance a manager factory returns: anything, with an optional dispose(). */
export interface Disposable { dispose?(): void }

/** A lazily created singleton with a global config. */
export interface Manager<T, C> {
  readonly name: string;
  /** The instance; created on first call. */
  get(): T;
  /** Is an instance alive (created and not disposed)? */
  alive(): boolean;
  /** Merge config. A live instance is disposed; the next get() creates one with the new config. */
  configure(config: Partial<C>): void;
  /** Current config (merged with the defaults). */
  config(): C;
  /** Shut the manager down (listeners removed). The next get() starts it again. */
  dispose(): void;
}

/** Define a manager: `create(config)` runs on first get(); its `dispose()` runs on configure/dispose. */
export function defineManager<T extends Disposable, C extends object>(name: string, create: (config: C) => T, defaults: C): Manager<T, C> {
  let cfg: C = { ...defaults };
  let inst: T | null = null;
  const version = signal(0, { name: `${name}.version` });
  const dispose = (): void => {
    if (!inst) return;
    const i = inst;
    inst = null;
    i.dispose?.();
    emit(name, "dispose");
    version.update((v) => v + 1);
  };
  return {
    name,
    get: () => {
      version();
      if (!inst) {
        // own root: the instance outlives the component that first asked for it, and nothing here is tracked
        inst = untrack(() => createRoot(() => create(cfg), null));
        emit(name, "start");
      }
      return inst;
    },
    alive: () => inst !== null,
    configure: (c) => { cfg = { ...cfg, ...c }; dispose(); },
    config: () => cfg,
    dispose,
  };
}
