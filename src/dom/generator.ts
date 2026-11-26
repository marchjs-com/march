// March — generator components (tree-shaken: only an app that writes a `function*` component pays for this file).
//   function* List()        each `yield` is added after the previous one, a frame at a time (a long list never blocks)
//   async function* Clock() each `yield` replaces the previous one; the nearest <Try loading> shows until the first
// `Comp.yields = "append" | "replace"` turns either default around; `Comp.chunk = n` draws n parts per frame (default:
// as many as fit in ~8 ms). When the component is removed the generator's return() runs (its finally blocks), a value
// that arrives after that is dropped, and a half-drawn list stops.
// The compiler turns `function* Name(` / `async function* Name(` (a capitalised declaration) into a plain component that
// calls _gen(); by hand: generator(function* Name() {…}).
import { getOwner, runWithOwner, reportError, onCleanup, useContext, _owner, _dispose, type Owner } from "../core/reactive.ts";
import { insert, clearBetween } from "./insert.ts";
import { LoadingContext, defaultLoading, type Component } from "./component.ts";

/** What a generator component may say about itself (static properties: `List.chunk = 20`). */
export interface GeneratorOptions {
  /** Parts drawn per frame (a sync generator); unset: as many as fit in about 8 ms. @tr Karede çizilen parça sayısı (senkron generator); verilmezse yaklaşık 8 ms'ye sığan kadar. */
  chunk?: number;
  /** "append": each yield is added after the last; "replace": each yield replaces the last. Default: append for `function*`, replace for `async function*`. @tr "append": her yield öncekinin yanına eklenir; "replace": öncekinin yerine geçer. Varsayılan: `function*` için append, `async function*` için replace. */
  yields?: "append" | "replace";
}
type Gen = Iterator<unknown, unknown, undefined> | AsyncIterator<unknown, unknown, undefined>;

const SLICE = 8;
const now = (): number => globalThis.performance?.now() ?? Date.now();
const later = (fn: () => void): void => { const raf = globalThis.requestAnimationFrame; if (raf) raf(fn); else setTimeout(fn, 16); };

/** Compiler helper (not for direct use): render a running generator `it` as a component's output. */
export function _gen(it: Gen, opts: GeneratorOptions = {}): Node {
  const owner = getOwner();
  const d = globalThis.document;
  const start = d.createComment(""), end = d.createComment(""), frag = d.createDocumentFragment();
  frag.append(start, end);
  const isAsync = Symbol.asyncIterator in it;
  const replace = (opts.yields ?? (isAsync ? "replace" : "append")) === "replace";
  // the generator's own owner: its body runs (and its JSX is created) under it; in replace mode what a step created is
  // moved to that step's owner and disposed when the next step replaces it (a ticking clock does not pile up effects)
  const g = _owner(owner);
  let alive = true, step: Owner | null = null, wait: Owner | null = null;
  const fail = (e: unknown): void => { if (alive) runWithOwner(owner, () => reportError(e, owner)); };
  onCleanup(() => {
    alive = false;
    if (step) _dispose(step);
    if (wait) _dispose(wait);
    _dispose(g);
    try { const r = it.return?.(undefined); if (r && typeof (r as Promise<unknown>).then === "function") (r as Promise<unknown>).then(undefined, () => {}); }
    catch { /* return() on a generator that is running right now (removed from inside its own step) */ }
  });
  const show = (v: unknown): void => {
    const host = end.parentNode;
    if (!alive || !host) return;
    if (wait) { _dispose(wait); wait = null; clearBetween(start, end); }
    let o: Owner = g;
    if (replace) {
      o = _owner(g);
      o.owned = g.owned; o.cleanups = g.cleanups; g.owned = g.cleanups = null;
      if (step) _dispose(step);
      step = o;
      clearBetween(start, end);
    }
    runWithOwner(o, () => insert(host, v, end));
  };

  if (isAsync) {
    const loading = useContext(LoadingContext);
    wait = _owner(owner);
    runWithOwner(wait, () => insert(frag, typeof loading === "function" ? loading() : defaultLoading(), end));
    const pump = (): void => {
      let p: Promise<IteratorResult<unknown>>;
      try { p = runWithOwner(g, () => (it as AsyncIterator<unknown>).next()); } catch (e) { fail(e); return; }
      p.then((r) => { if (!alive || r.done) return; show(r.value); pump(); }, fail);
    };
    pump();
    return frag;
  }

  const sync = it as Iterator<unknown>;
  // one frame of work: parts until the chunk count or the time slice is used up, then the rest on the next frame
  const frame = (first: boolean): void => {
    const t0 = now();
    for (let n = 1; alive; n++) {
      let r: IteratorResult<unknown>;
      try { r = runWithOwner(g, () => sync.next()); } catch (e) { if (first) throw e; fail(e); return; }
      if (r.done) return;
      show(r.value);
      if (opts.chunk ? n >= opts.chunk : now() - t0 > SLICE) { later(() => frame(false)); return; }
    }
  };
  frame(true);
  return frag;
}

/**
 * Make a component of a generator function (the compiler does this for `function* Name` declarations; use it for a
 * generator written as an expression or with h() by hand). `opts` as the static properties: `{ chunk, yields }`.
 */
export function generator<P>(fn: (props: P) => Gen, opts?: GeneratorOptions): Component<P> & GeneratorOptions {
  const C = ((props: P) => _gen(fn(props), C)) as Component<P> & GeneratorOptions;
  Object.defineProperty(C, "name", { value: fn.name });
  return Object.assign(C, opts);
}
