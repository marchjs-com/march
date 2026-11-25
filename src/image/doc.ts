// imageDoc: the non-destructive edit state. The original never changes; the edit is an op list you reorder, switch
// off, undo and redo (UndoManager's history), save as JSON and share as a short preset string.
//   const doc = imageDoc();  doc.set("exposure", { amount: 0.5 });  doc.undo();  const json = doc.toJSON();
import { signal, batch, type Accessor } from "../core/reactive.ts";
import { undoHistory, type UndoStack } from "../managers/undo/history.ts";
import { defOf, type ImageOp } from "./op.ts";

/** A saved edit (JSON). */
export interface ImageEdit { version: 1; ops: ImageOp[]; meta?: Record<string, unknown> | undefined }

export interface ImageDoc {
  /** The edit list (reactive). */
  ops: Accessor<ImageOp[]>;
  /** Append (or insert at `at`) an op; returns its id. */
  add(op: ImageOp, at?: number): string;
  /** Upsert by type: change the first op of `type` (or add one). Slider drags merge into one undo step. */
  set(type: string, params: Record<string, unknown>, opts?: { merge?: boolean | undefined; label?: string | undefined; make?: (() => ImageOp) | undefined }): string;
  /** Change an op's params (merge: same undo step while dragging). */
  update(id: string, params: Record<string, unknown>, merge?: boolean): void;
  /** Change an op's strength 0–1. */
  setMix(id: string, mix: number, merge?: boolean): void;
  remove(id: string): void;
  /** Move an op to a new index. */
  move(id: string, to: number): void;
  /** Switch an op on / off (toggle when `on` is omitted). */
  toggle(id: string, on?: boolean): void;
  /** Replace the whole list (one undo step). */
  replace(ops: readonly ImageOp[], label?: string): void;
  /** Remove every op (one undo step). */
  reset(): void;
  /** First op of a type. */
  find(type: string): ImageOp | undefined;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  canUndo(): boolean;
  canRedo(): boolean;
  /** The undo history (labels, saved point). */
  history: UndoStack;
  toJSON(): ImageEdit;
  /** Load a saved edit (one undo step). */
  load(edit: ImageEdit | ImageOp[]): void;
}

let seq = 0;
const newId = (): string => `op${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const plain = (op: ImageOp): ImageOp => {
  const o: ImageOp = { type: op.type, params: { ...op.params } };
  if (op.id) o.id = op.id;
  if (op.on === false) o.on = false;
  if (op.mix != null && op.mix !== 1) o.mix = op.mix;
  return o;
};
/** Keep the implementation a function-made op carries. */
const keep = (from: ImageOp, to: ImageOp): ImageOp => { const d = defOf(from); if (d && !defOf(to)) Object.defineProperty(to, Symbol.for("march.image.op"), { value: d, enumerable: false }); return to; };

/** A non-destructive edit list with undo / redo. */
export function imageDoc(init: { ops?: readonly ImageOp[] | undefined; history?: UndoStack | undefined } = {}): ImageDoc {
  const ops = signal<ImageOp[]>((init.ops ?? []).map((o) => keep(o, { ...o, id: o.id ?? newId() })));
  const history = init.history ?? undoHistory({ mergeMs: 1200 });
  const commit = (label: string, next: ImageOp[], merge?: string): void => {
    const prev = ops.peek();
    if (prev === next) return;
    history.run(label, () => ops.set(next), () => ops.set(prev), merge);
  };
  const at = (id: string): number => ops.peek().findIndex((o) => o.id === id);
  const label = (o: ImageOp | undefined): string => o?.type ?? "edit";
  const doc: ImageDoc = {
    ops,
    history,
    add(op, i) {
      const o = keep(op, { ...op, params: { ...op.params }, id: op.id ?? newId() });
      const list = ops.peek().slice();
      list.splice(i ?? list.length, 0, o);
      commit(`add ${o.type}`, list);
      return o.id!;
    },
    set(type, params, opts = {}) {
      const cur = ops.peek().find((o) => o.type === type);
      if (!cur) { const base = opts.make?.() ?? { type, params: {} }; return doc.add({ ...base, params: { ...base.params, ...params } }); }
      doc.update(cur.id!, params, opts.merge);
      return cur.id!;
    },
    update(id, params, merge) {
      const i = at(id); if (i < 0) return;
      const list = ops.peek().slice(), o = list[i]!;
      list[i] = keep(o, { ...o, params: { ...o.params, ...params } });
      commit(label(o), list, merge ? `p:${id}` : undefined);
    },
    setMix(id, mix, merge) {
      const i = at(id); if (i < 0) return;
      const list = ops.peek().slice(), o = list[i]!;
      list[i] = keep(o, { ...o, mix: Math.min(1, Math.max(0, mix)) });
      commit(`${label(o)} strength`, list, merge ? `m:${id}` : undefined);
    },
    remove(id) { const i = at(id); if (i < 0) return; const list = ops.peek().slice(); const [o] = list.splice(i, 1); commit(`remove ${label(o)}`, list); },
    move(id, to) {
      const i = at(id); if (i < 0) return;
      const list = ops.peek().slice(), [o] = list.splice(i, 1);
      list.splice(Math.max(0, Math.min(list.length, to)), 0, o!);
      commit(`move ${label(o)}`, list);
    },
    toggle(id, on) {
      const i = at(id); if (i < 0) return;
      const list = ops.peek().slice(), o = list[i]!, next = on ?? o.on === false;
      list[i] = keep(o, { ...o, on: next });
      commit(`${next ? "show" : "hide"} ${label(o)}`, list);
    },
    replace(list, l = "replace") { commit(l, list.map((o) => keep(o, { ...o, params: { ...o.params }, id: o.id ?? newId() }))); },
    reset() { if (ops.peek().length) commit("reset", []); },
    find: (type) => ops().find((o) => o.type === type),
    undo: () => history.undo(),
    redo: () => history.redo(),
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    toJSON: () => ({ version: 1, ops: ops.peek().map(plain) }),
    load(edit) { batch(() => doc.replace(Array.isArray(edit) ? edit : edit.ops, "load")); },
  };
  return doc;
}

// ---------------------------------------------------------------- shareable presets
const b64url = (s: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string): string => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

/** A short, URL-safe string for an edit list (ids dropped, numbers rounded): share a look as a link or a code. */
export function encodePreset(ops: readonly ImageOp[], name?: string): string {
  const round = (v: unknown): unknown => (typeof v === "number" ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);
  const body = { n: name, o: ops.filter((o) => o.on !== false).map((o) => (o.mix != null && o.mix !== 1 ? [o.type, round(o.params), round(o.mix)] : [o.type, round(o.params)])) };
  return `m1.${b64url(JSON.stringify(body))}`;
}

/** Read a preset string back (throws on a malformed one). */
export function decodePreset(code: string): { name?: string | undefined; ops: ImageOp[] } {
  const m = /^m1\.([A-Za-z0-9_-]+)$/.exec(code.trim());
  if (!m) throw new Error("decodePreset: not a March image preset");
  const body = JSON.parse(unb64url(m[1]!)) as { n?: string; o: [string, Record<string, unknown>, number?][] };
  if (!Array.isArray(body.o)) throw new Error("decodePreset: no ops");
  return { name: body.n, ops: body.o.filter((x) => Array.isArray(x) && typeof x[0] === "string" && x[1] && typeof x[1] === "object").map(([type, params, mix]) => (mix != null ? { type, params, mix } : { type, params })) };
}
