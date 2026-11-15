// The CodeEditor's undo history: each step is the change itself (where, what was removed, what was written, the
// selection before and after), not a copy of the text, so hundreds of steps stay small. Typing a word, or deleting
// characters one after another, is one step. With a key the history is kept in the browser session (sessionStorage):
// it survives the editor being drawn again (a tab switch) and a page reload, and only applies to the same text.

/** One step: [at, at + ins.length) holds `ins`, which replaced `del`. */
export interface UndoStep { at: number; del: string; ins: string; sb: readonly [number, number]; sa: readonly [number, number]; t: number }
export interface UndoHistory {
  /** A change of the text from `prev` to `next` (the selection before it, and after). */
  record(prev: string, next: string, before: readonly [number, number], after: readonly [number, number] | null): void;
  undo(value: string): { value: string; sel: readonly [number, number] } | null;
  redo(value: string): { value: string; sel: readonly [number, number] } | null;
  /** How many steps can be undone / redone. */
  size(): { undo: number; redo: number };
  /** Keep it (with a key) for the text as it is now. */
  save(value: string): void;
  /** Take the kept history back, when it was kept for this text. */
  load(value: string): boolean;
  clear(): void;
}

/** The change from a to b as one replaced range (common start and end kept out), or null when they are equal. */
export function diff(a: string, b: string): { at: number; del: string; ins: string } | null {
  if (a === b) return null;
  let s = 0;
  const max = Math.min(a.length, b.length);
  while (s < max && a.charCodeAt(s) === b.charCodeAt(s)) s++;
  let e = 0;
  while (e < max - s && a.charCodeAt(a.length - 1 - e) === b.charCodeAt(b.length - 1 - e)) e++;
  return { at: s, del: a.slice(s, a.length - e), ins: b.slice(s, b.length - e) };
}

const WORD = /[\w$]/;
export function createHistory(o: { limit?: number | undefined; key?: string | undefined; merge?: number | undefined } = {}): UndoHistory {
  const limit = Math.max(1, o.limit ?? 500), mergeMs = o.merge ?? 1000;
  let undo: UndoStep[] = [], redo: UndoStep[] = [];
  const store = (): Storage | null => { try { return o.key ? globalThis.sessionStorage ?? null : null; } catch { return null; } };
  const storeKey = `march.ced.undo:${o.key ?? ""}`;
  return {
    record(prev, next, before, after) {
      const d = diff(prev, next);
      if (!d) return;
      const t = Date.now(), sa = after ?? [d.at + d.ins.length, d.at + d.ins.length] as const;
      const last = undo[undo.length - 1];
      redo = [];
      // typing a word: one step (a space or a new line starts the next one)
      if (last && t - last.t < mergeMs) {
        if (!d.del && d.ins.length === 1 && !last.del && last.ins && d.at === last.at + last.ins.length && WORD.test(d.ins) === WORD.test(last.ins.slice(-1))) {
          last.ins += d.ins; last.sa = sa; last.t = t; return;
        }
        // Backspace after Backspace, Delete after Delete
        if (!d.ins && d.del.length === 1 && !last.ins && last.del) {
          if (d.at === last.at - 1) { last.del = d.del + last.del; last.at = d.at; last.sa = sa; last.t = t; return; }
          if (d.at === last.at) { last.del += d.del; last.sa = sa; last.t = t; return; }
        }
      }
      undo.push({ ...d, sb: before, sa, t });
      if (undo.length > limit) undo.splice(0, undo.length - limit);
    },
    undo(value) {
      const s = undo.pop();
      if (!s || value.slice(s.at, s.at + s.ins.length) !== s.ins) { if (s) undo = []; return null; }
      redo.push(s);
      return { value: value.slice(0, s.at) + s.del + value.slice(s.at + s.ins.length), sel: s.sb };
    },
    redo(value) {
      const s = redo.pop();
      if (!s || value.slice(s.at, s.at + s.del.length) !== s.del) { if (s) redo = []; return null; }
      s.t = 0; // a redone step is not typed into again
      undo.push(s);
      return { value: value.slice(0, s.at) + s.ins + value.slice(s.at + s.del.length), sel: s.sa };
    },
    size: () => ({ undo: undo.length, redo: redo.length }),
    save(value) {
      const st = store();
      if (!st) return;
      // too big for the session's room: the oldest half goes first
      for (let keep = undo.length; keep >= 0; keep = keep ? Math.floor(keep / 2) : -1) {
        try { st.setItem(storeKey, JSON.stringify({ value, undo: undo.slice(undo.length - keep), redo })); return; } catch { /* full */ }
      }
    },
    load(value) {
      const st = store();
      if (!st) return false;
      try {
        const raw = st.getItem(storeKey), kept = raw ? JSON.parse(raw) as { value: string; undo: UndoStep[]; redo: UndoStep[] } : null;
        if (!kept || kept.value !== value) return false;
        undo = kept.undo.slice(-limit).map((s) => ({ ...s, t: 0 })); redo = kept.redo ?? [];
        return true;
      } catch { return false; }
    },
    clear() { undo = []; redo = []; try { store()?.removeItem(storeKey); } catch { /* private mode */ } },
  };
}
