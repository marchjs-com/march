// march/studio: the editing core shared by the video editor, the audio timeline, the mixer and the recording studio.
// A project is plain JSON (model.ts); `studio()` holds one with undo / redo, a selection, a playhead and an operation
// log (co-editing replays the same operations elsewhere); `transport()` is the play clock.
//
//   const s = studio(emptyProject())
//   s.do("addTrack", { kind: "audio" }); s.do("split", clipId, 4.2); s.undo()
//   s.onOp((op) => channel.send(op))  …  s.apply(remoteOp)          // co-editing
//   const tp = transport({ duration: () => projectDuration(s.project()) }); tp.play(); tp.time()
import { signal, computed, batch, untrack, onCleanup, getOwner, type Accessor } from "../core/reactive.ts";
import { undoHistory } from "../managers/undo/history.ts";
import type { UndoStack } from "../managers/undo/history.ts";
import { onFrame } from "../motion/engine/clock.ts";
import * as M from "./model.ts";
import type { Project } from "./model.ts";

export * from "./model.ts";

/** The edit operations `studio().do()` knows, by name (each a pure function of the project). */
export const OPS = {
  addTrack: M.addTrack, updateTrack: M.updateTrack, removeTrack: M.removeTrack, moveTrack: M.moveTrack,
  addClip: M.addClip, updateClip: M.updateClip, remove: M.remove, split: M.split, splitAll: M.splitAll, cutRange: M.cutRange,
  trim: M.trim, roll: M.roll, slip: M.slip, slide: M.slide, move: M.move, setSpeed: M.setSpeed, link: M.link, clear: M.clear,
  addMedia: M.addMedia, removeMedia: M.removeMedia, addMarker: M.addMarker, updateMarker: M.updateMarker, removeMarker: M.removeMarker,
  set: (_p: Project, next: Project): Project => next,
  patch: (p: Project, patch: Partial<Project>): Project => ({ ...p, ...patch, version: 1 }),
} as const;
export type OpName = keyof typeof OPS;
const extraOps: Record<string, (p: Project, ...a: never[]) => Project> = {};
/** Add an operation every studio knows (`s.do(name, …)`): a pure function of the project. Undo / redo and co-editing treat it like the built-in ones. Returns a remover. */
export function registerOp(name: string, fn: (p: Project, ...args: never[]) => Project): () => void {
  extraOps[name] = fn;
  return () => { if (extraOps[name] === fn) delete extraOps[name]; };
}
/** Apply a recorded operation to a project without a studio (pure): `applyOp(p, { op: "split", args: [id, 3] })`. */
export function applyOp(p: Project, op: Pick<StudioOp, "op" | "args">): Project {
  const fn = (OPS as unknown as Record<string, unknown>)[op.op] ?? extraOps[op.op];
  if (typeof fn !== "function") throw new Error(`march/studio: unknown operation "${op.op}"`);
  return (fn as (p: Project, ...a: unknown[]) => Project)(p, ...op.args);
}
type Args<K extends OpName> = (typeof OPS)[K] extends (p: Project, ...a: infer A) => Project ? A : never;
/** One recorded edit: the operation's name and its arguments (JSON), who made it, and the project version it led to. */
export interface StudioOp { op: OpName | (string & {}); args: unknown[]; by?: string | undefined; rev: number; label?: string | undefined }

export interface StudioOptions {
  /** Undo steps kept (default 200). */
  limit?: number | undefined;
  /** Who makes the edits here (co-editing: ops carry it). */
  user?: string | undefined;
  /** Extra operations (`do("myOp", …)`), each a pure function of the project. */
  ops?: Record<string, (p: Project, ...args: never[]) => Project> | undefined;
}

export interface Studio {
  /** The project (reactive). */
  project: Accessor<Project>;
  /** Run an edit operation by name; it is undoable and goes to `onOp` listeners. Returns the new project. */
  do<K extends OpName>(op: K, ...args: Args<K>): Project;
  do(op: string, ...args: unknown[]): Project;
  /** Several operations as one undo step. */
  group<R>(label: string, fn: () => R): R;
  /** Apply an operation from elsewhere (co-editing); not sent back out, undoable locally. */
  apply(op: StudioOp): Project;
  /** Listen to the operations made here. Returns a remover. */
  onOp(fn: (op: StudioOp) => void): () => void;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  history: UndoStack;
  /** Selected clip ids (reactive). */
  selection: Accessor<readonly string[]>;
  select(ids: readonly string[] | string | null, add?: boolean): void;
  /** Playhead, s (reactive). */
  playhead: Accessor<number>;
  setPlayhead(t: number): void;
  /** Project length, s (reactive). */
  duration: Accessor<number>;
  /** Revision number: grows with every change. */
  rev: Accessor<number>;
  /** Saved versions (name, time, project); `saveVersion` stores the current project, `restore` brings one back. */
  versions: Accessor<readonly StudioVersion[]>;
  saveVersion(name?: string): StudioVersion;
  restore(id: string): void;
  /** The project as JSON text (indent optional). */
  toJSON(indent?: number): string;
}
/** A saved version of a project. */
export interface StudioVersion { id: string; name: string; at: number; project: Project }

/** Parse project JSON (from `toJSON` or a file); throws on a wrong shape. */
export function parseProject(text: string): Project {
  const p = JSON.parse(text) as Project;
  if (!p || p.version !== 1 || !Array.isArray(p.tracks) || !Array.isArray(p.clips)) throw new Error("march/studio: not a project (version 1)");
  return { ...p, markers: p.markers ?? [], buses: p.buses ?? [], master: p.master ?? {} };
}

/** An editing session over a project: undoable operations, selection, playhead, versions, an operation log. */
export function studio(initial: Project = M.emptyProject(), o: StudioOptions = {}): Studio {
  const project = signal<Project>(initial, { name: "studio.project" });
  const selection = signal<readonly string[]>([]);
  const playhead = signal(0);
  const rev = signal(0);
  const versions = signal<readonly StudioVersion[]>([]);
  const history = undoHistory({ limit: o.limit ?? 200, mergeMs: 0 });
  const listeners = new Set<(op: StudioOp) => void>();
  const ops: Record<string, (p: Project, ...a: never[]) => Project> = { ...(OPS as unknown as Record<string, (p: Project, ...a: never[]) => Project>), ...o.ops };

  const commit = (next: Project, label: string, op?: StudioOp, quiet = false): Project => {
    const prev = untrack(project);
    if (next === prev) return prev;
    history.run(label, () => batch(() => { project.set(next); rev.set(rev.peek() + 1); }), () => batch(() => { project.set(prev); rev.set(rev.peek() + 1); }));
    // clips that no longer exist leave the selection
    const ids = new Set(next.clips.map((c) => c.id));
    if (selection.peek().some((id) => !ids.has(id))) selection.set(selection.peek().filter((id) => ids.has(id)));
    if (op && !quiet) for (const fn of listeners) fn({ ...op, rev: rev.peek() });
    return next;
  };
  const run = (op: string, args: unknown[], quiet: boolean, by?: string): Project => {
    const fn = ops[op] ?? extraOps[op];
    if (!fn) throw new Error(`march/studio: unknown operation "${op}"`);
    const next = (fn as (p: Project, ...a: unknown[]) => Project)(untrack(project), ...args);
    return commit(next, op, { op, args, by: by ?? o.user, rev: 0 }, quiet);
  };

  const s: Studio = {
    project,
    do: ((op: string, ...args: unknown[]) => run(op, args, false)) as Studio["do"],
    group: (label, fn) => history.transaction(label, fn),
    apply: (op) => run(op.op, op.args, true, op.by),
    onOp(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    undo: () => history.undo(),
    redo: () => history.redo(),
    history,
    selection,
    select(ids, add) {
      const list = ids == null ? [] : typeof ids === "string" ? [ids] : ids;
      selection.set(add ? [...new Set([...selection.peek(), ...list])] : [...list]);
    },
    playhead,
    setPlayhead: (t) => playhead.set(Math.max(0, t)),
    duration: computed(() => M.projectDuration(project())),
    rev,
    versions,
    saveVersion(name) {
      const v: StudioVersion = { id: M.newId("v"), name: name ?? `v${versions.peek().length + 1}`, at: Date.now(), project: untrack(project) };
      versions.set([...versions.peek(), v]);
      history.markSaved();
      return v;
    },
    restore(id) {
      const v = versions.peek().find((x) => x.id === id);
      if (v) commit(v.project, "restore", { op: "set", args: [v.project], rev: 0 });
    },
    toJSON: (indent) => JSON.stringify(untrack(project), null, indent),
  };
  if (getOwner()) onCleanup(() => history.dispose());
  return s;
}

// ── transport ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TransportOptions {
  /** Length, s (the end stops or loops). */
  duration?: (() => number) | number | undefined;
  /** Start time, s. */
  time?: number | undefined;
  /** Play rate (default 1). */
  rate?: number | undefined;
  /** Loop range [from, to] in s, or true for the whole length. */
  loop?: boolean | readonly [number, number] | undefined;
  /** A clock to follow while playing (an AudioContext keeps sound and picture in step); default: the frame clock. */
  clock?: (() => number) | undefined;
  /** Called on each time change while playing. */
  onTime?: ((t: number) => void) | undefined;
  onEnded?: (() => void) | undefined;
}
export interface Transport {
  time: Accessor<number>;
  playing: Accessor<boolean>;
  rate: Accessor<number>;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(t: number): void;
  setRate(r: number): void;
  setLoop(loop: boolean | readonly [number, number]): void;
  loop: Accessor<boolean | readonly [number, number]>;
  dispose(): void;
}

/**
 * The play clock of an editor: time, play / pause, seek, rate, loop. It runs on the motion engine's clock as essential
 * work (media keeps real time: global animation speed does not slow playback), or follows `clock` (AudioContext time).
 */
export function transport(o: TransportOptions = {}): Transport {
  const time = signal(o.time ?? 0), playing = signal(false), rate = signal(o.rate ?? 1);
  const loop = signal<boolean | readonly [number, number]>(o.loop ?? false);
  const D = (): number => (typeof o.duration === "function" ? o.duration() : o.duration ?? Infinity);
  let stop: (() => void) | null = null, base = 0, from = 0;
  const now = (): number => (o.clock ? o.clock() * 1000 : performance.now());
  const tick = (): void => {
    let t = from + ((now() - base) / 1000) * rate.peek();
    const lp = loop.peek(), end = untrack(D);
    const [a, b] = lp === true ? [0, end] : lp ? lp : [0, end];
    if (lp && t >= b) { from = a + ((t - a) % Math.max(1e-3, b - a)); base = now(); t = from; }
    else if (!lp && t >= end) { t = end; time.set(t); s.pause(); o.onEnded?.(); return; }
    time.set(t);
    o.onTime?.(t);
  };
  const s: Transport = {
    time, playing, rate, loop,
    play() {
      if (playing.peek()) return;
      if (time.peek() >= untrack(D) - 1e-3 && !loop.peek()) time.set(0);
      from = time.peek(); base = now(); playing.set(true);
      stop = onFrame(tick, { essential: true });
    },
    pause() { if (!playing.peek()) return; tick(); stop?.(); stop = null; playing.set(false); },
    toggle() { if (playing.peek()) s.pause(); else s.play(); },
    seek(t) { const v = Math.max(0, Math.min(t, untrack(D))); from = v; base = now(); time.set(v); o.onTime?.(v); },
    setRate(r) { if (playing.peek()) { from = time.peek(); base = now(); } rate.set(r); },
    setLoop: (l) => loop.set(l),
    dispose() { stop?.(); stop = null; playing.set(false); },
  };
  if (getOwner()) onCleanup(() => s.dispose());
  return s;
}
