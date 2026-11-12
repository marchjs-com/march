// The manager pattern: one instance per app, created on first use (lazy), configured globally, shut down with dispose.
//
//   const vp = defineManager("viewport", (config: ViewportConfig) => createViewport(config), {});
//   vp.get()          // the instance (created now if needed)
//   vp.configure({…}) // merge config; a live instance is disposed and re-created on next use
//   vp.dispose()      // remove listeners, forget the instance
//
// Bindings that read through get() follow a re-configured instance: get() tracks a version signal.
//
// Events: every manager reports through emit(manager, type, detail); the app, devtools or the messaging layer listen
// with setManagerEmit(fn) (docs/architecture.md).

import { signal, untrack, createRoot } from "../core/reactive.ts";

/** One event a manager reports, e.g. { manager: "consent", type: "change", detail: { analytics: true } }. */
export interface ManagerEvent { manager: string; type: string; detail?: unknown }
export type ManagerEmit = (e: ManagerEvent) => void;

let sink: ManagerEmit | null = null;
/** Receive every manager event (one sink: the app, devtools or the messaging layer). Returns the previous sink. */
export function setManagerEmit(fn: ManagerEmit | null): ManagerEmit | null { const prev = sink; sink = fn; return prev; }
/** Report an event from a manager. Never throws into the manager. */
export function emit(manager: string, type: string, detail?: unknown): void {
  if (!sink) return;
  try { sink({ manager, type, detail }); } catch (e) { console.error(e); }
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
