// <Await>: render a promise (pending, value, error) (its own module: see dom/flow.ts).
import { signal, getOwner, runWithOwner, untrack, onCleanup, effect, reportError } from "../core/reactive.ts";
import { val, call, type MaybeFn } from "./flow.ts";

export interface AwaitProps<T> {
  /** The promise (or plain value, signal or function returning one) to wait for; a new one restarts the wait. @tr Beklenecek promise (ya da düz değer, sinyal veya onu döndüren fonksiyon); yenisi gelince bekleme baştan başlar. */
  for: MaybeFn<T | PromiseLike<T>>;
  /** Rendered while the promise is pending. @tr Promise beklenirken gösterilir. */
  loading?: unknown;
  /** Rendered when the promise rejects: content or `(error) => content`; without it the error goes to the nearest Try. @tr Promise reddedilince gösterilir: içerik ya da `(error) => content`; verilmezse hata en yakın Try'a gider. */
  catch?: unknown;
  /** Content, or `(value) => content`. @tr İçerik ya da `(value) => content`. */
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
