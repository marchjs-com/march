// Control flow components: If/Else, Try (For: dom/for.ts, Switch/Match: dom/switch.ts, Await: dom/await.ts, Dynamic: dom/dynamic.ts,
// Portal: dom/portal.ts — each in its own module, so a page that uses one does not put the others into a shared chunk).
// Each returns a live region; only the active branch exists in the DOM and it is disposed (with its listeners) on switch.
import { computed, signal, untrack, catchError, provide, isReactive } from "../core/reactive.ts";
import { h, LoadingContext } from "./h.ts";

/** A value, a signal or any function returning the value. */
export type MaybeFn<T> = T | (() => T);

// Call user render functions; keep reactive accessors (compiler thunks, signals) as live regions.
// Flow props (when, each, for) accept a value, a signal or any function returning the value.
export const val = <T>(v: MaybeFn<T>): T => (typeof v === "function" ? (v as () => T)() : v);
export const call = (c: unknown, ...a: unknown[]): unknown => (typeof c === "function" && !isReactive(c) ? (c as (...x: unknown[]) => unknown)(...a) : c);

export interface IfProps<T = unknown> {
  when: MaybeFn<T>;
  else?: unknown;
  fallback?: unknown;
  /** Content, or `(value) => content` receiving the truthy value. */
  children?: unknown;
}
/** `<If when={cond} else={…}>…<Else>…</Else></If>` — children may be `(value) => …` to receive the truthy value. */
export function If<T>(props: IfProps<T>): () => unknown {
  const cond = computed(() => val(props.when));
  const on = computed(() => !!cond());
  return () => (on() ? untrack(() => call(props.children, cond.peek())) : call(props.else ?? props.fallback));
}
/** Marker used by the compiler; at runtime `<Else>` outside `<If>` renders its children. */
export function Else(props: { children?: unknown }): unknown { return props.children; }

// <For> lives in dom/for.ts (not re-exported here: a page that only needs If/Try must not pull it into its chunk).

export interface TryProps {
  /** Rendered on error: content or `(error, reset) => content`. */
  fallback?: unknown;
  /** Rendered while async children are pending. */
  loading?: unknown;
  /** `false` disables console.error logging. */
  log?: boolean;
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
function defaultError(e: unknown, reset: () => unknown): Element {
  return h("div", { class: "m-error", role: "alert" },
    h("p", {}, String((e as { message?: unknown } | null)?.message ?? e)),
    h("button", { type: "button", class: "m-btn", onClick: reset }, "Retry"));
}
