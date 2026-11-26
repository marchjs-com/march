// Control flow components: If/Else, Try (For: dom/for.ts, Switch/Match: dom/switch.ts, Await: dom/await.ts, Dynamic: dom/dynamic.ts,
// Portal: dom/portal.ts — each in its own module, so a page that uses one does not put the others into a shared chunk).
// Each returns a live region; only the active branch exists in the DOM and it is disposed (with its listeners) on switch.
import { computed, signal, untrack, catchError, provide } from "../core/reactive.ts";
import { LoadingContext } from "./component.ts";
import { doc } from "./insert.ts";
import { _on } from "./events.ts";
import { val, call, type MaybeFn } from "./val.ts";
export { val, call, type MaybeFn };

export interface IfProps<T = unknown> {
  /** The condition (value, signal or function); children render while it is truthy. @tr Koşul (değer, sinyal ya da fonksiyon); doğru (truthy) olduğu sürece children gösterilir. */
  when: MaybeFn<T>;
  /** Rendered while `when` is falsy. @tr `when` yanlış (falsy) olduğunda gösterilir. */
  else?: unknown;
  /** Same as `else` (used when `else` is not given). @tr `else` ile aynı (`else` verilmezse kullanılır). */
  fallback?: unknown;
  /** Content, or `(value) => content` receiving the truthy value. @tr İçerik ya da doğru (truthy) değeri alan `(value) => content`. */
  children?: unknown;
}
/** `<If when={cond} else={…}>…<Else>…</Else></If>` — children may be `(value) => …` to receive the truthy value. */
export function If<T>(props: IfProps<T>): () => unknown {
  const cond = computed(() => val(props.when));
  const on = computed(() => !!cond());
  return () => (on() ? untrack(() => call(props.children, cond.peek())) : call(props.else ?? props.fallback));
}
/** Marker used by the compiler; at runtime `<Else>` outside `<If>` renders its children. */
export function Else(props: {
  /** Content shown when the `<If>` condition is falsy. @tr `<If>` koşulu yanlış (falsy) olduğunda gösterilen içerik. */
  children?: unknown;
}): unknown { return props.children; }

// <For> lives in dom/for.ts (not re-exported here: a page that only needs If/Try must not pull it into its chunk).

export interface TryProps {
  /** Rendered on error: content or `(error, reset) => content`. @tr Hata olunca gösterilir: içerik ya da `(error, reset) => content`. */
  fallback?: unknown;
  /** Rendered while async children are pending. @tr Async children beklenirken gösterilir. */
  loading?: unknown;
  /** `false` disables console.error logging. @tr `false` console.error kaydını kapatır. */
  log?: boolean;
  /** The guarded content. @tr Korunan içerik. */
  children?: unknown;
}
/**
 * Error and async boundary. `fallback(error, reset)` renders on error; `loading` renders while async children are pending.
 * Also catches errors thrown by async components and by effects inside.
 */
export function Try(props: TryProps): () => unknown {
  const err = signal<unknown>(null);
  const reset = (): unknown => err.set(null);
  return () => {
    const e = err();
    if (e) return untrack(() => (typeof props.fallback === "function" ? (props.fallback as (e: unknown, reset: () => unknown) => unknown)(e, reset) : props.fallback ?? defaultError(e, reset)));
    return catchError(() => {
      if (props.loading !== undefined) provide(LoadingContext, () => call(props.loading));
      return props.children;
    }, (x) => { if (props.log !== false) console.error(x); err.set(x); });
  };
}
// made with DOM calls, not h(): a page with <If> or <Try> does not load every prop kind for this one box
function defaultError(e: unknown, reset: () => unknown): Element {
  const d = doc(), box = d.createElement("div"), p = d.createElement("p"), b = d.createElement("button");
  box.className = "m-error";
  box.setAttribute("role", "alert");
  p.textContent = String((e as { message?: unknown } | null)?.message ?? e);
  b.type = "button";
  b.className = "m-btn";
  b.textContent = "Retry";
  _on(b, "click", reset);
  box.append(p, b);
  return box;
}
