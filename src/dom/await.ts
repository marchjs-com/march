// <Await>: render a promise (pending, value, error) (its own module: see dom/flow.ts).
import { signal, getOwner, runWithOwner, untrack, onCleanup, effect, reportError } from "../core/reactive.ts";
import { val, call, type MaybeFn } from "./flow.ts";

export interface AwaitProps<T> {
  for: MaybeFn<T | PromiseLike<T>>;
  loading?: unknown;
  catch?: unknown;
  /** Content, or `(value) => content`. */
  children?: unknown;
}
type AwaitState<T> = { s: "pending" } | { s: "ok"; v: T } | { s: "err"; e: unknown };
/** `<Await for={promise} loading={…} catch={(e) => …}>{(value) => …}</Await>` */
export function Await<T>(props: AwaitProps<T>): () => unknown {
  const state = signal<AwaitState<T>>({ s: "pending" });
  const owner = getOwner();
  effect(() => {
    const p = val(props.for);
    let alive = true;
    onCleanup(() => { alive = false; });
    state.set({ s: "pending" });
    Promise.resolve(p).then((v) => alive && state.set({ s: "ok", v }), (e: unknown) => alive && state.set({ s: "err", e }));
  });
  return () => {
    const st = state();
    if (st.s === "ok") return untrack(() => call(props.children, st.v));
    if (st.s === "err") {
      if (props.catch) return untrack(() => call(props.catch, st.e));
      runWithOwner(owner, () => reportError(st.e, owner));
      return null;
    }
    return call(props.loading ?? null);
  };
}
