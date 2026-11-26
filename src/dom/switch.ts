// <Switch>/<Match>: the first truthy Match renders (its own module: see dom/flow.ts).
import { computed, untrack } from "../core/reactive.ts";
import { val, call, type MaybeFn } from "./val.ts";

/** Descriptor produced by `<Match>`. */
export interface MatchDescriptor { readonly __match: true; readonly when: unknown; readonly children: () => unknown }
export interface SwitchProps {
  /** Rendered when no `<Match>` is truthy. @tr Hiçbir `<Match>` doğru (truthy) değilse gösterilir. */
  fallback?: unknown;
  /** The `<Match>` branches. @tr `<Match>` dalları. */
  children?: unknown;
}
/** `<Switch fallback={…}><Match when={a}>…</Match>…</Switch>` — first truthy Match wins. */
export function Switch(props: SwitchProps): () => unknown {
  const matches = computed(() => {
    const kids = ([] as unknown[]).concat(props.children ?? []).flat();
    return kids.filter((m): m is MatchDescriptor => !!m && !!(m as Partial<MatchDescriptor>).__match);
  });
  const active = computed((): { i: number; v: unknown } | null => {
    const ms = matches();
    for (let i = 0; i < ms.length; i++) { const v = val((ms[i] as MatchDescriptor).when); if (v) return { i, v }; }
    return null;
  }, { equals: (a, b) => a?.i === b?.i });
  return () => {
    const a = active();
    if (!a) return call(props.fallback);
    const m = matches.peek()[a.i] as MatchDescriptor;
    return untrack(() => call(m.children, val(m.when)));
  };
}
export interface MatchProps<T = unknown> {
  /** The condition; the first truthy `<Match>` in its `<Switch>` renders. @tr Koşul; `<Switch>` içinde ilk doğru (truthy) `<Match>` gösterilir. */
  when: MaybeFn<T>;
  /** Content, or `(value) => content` receiving the truthy value. @tr İçerik ya da doğru (truthy) değeri alan `(value) => content`. */
  children?: unknown;
}
/** Descriptor used by `<Switch>`; its children stay lazy. */
export function Match<T>(props: MatchProps<T>): MatchDescriptor {
  const d = { __match: true };
  Object.defineProperty(d, "when", { get: () => props.when });
  Object.defineProperty(d, "children", { get: () => () => props.children });
  return d as MatchDescriptor;
}
