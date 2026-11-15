// <Dynamic>: a component chosen at runtime (its own module: see dom/flow.ts).
import { read, untrack } from "../core/reactive.ts";
import { h, type Component } from "./h.ts";
import type { MaybeFn } from "./flow.ts";

export type DynamicProps = {
  /** The component (or tag name) to render; null, undefined or false renders nothing. @tr Gösterilecek bileşen (ya da etiket adı); null, undefined veya false hiçbir şey göstermez. */
  component: MaybeFn<string | Component<never> | null | undefined | false>;
} & Record<string, unknown>;
/** Render a component chosen at runtime: `<Dynamic component={X} {...props} />`. */
export function Dynamic(props: DynamicProps): () => unknown {
  return () => {
    const C = read(props.component);
    if (!C) return null;
    const rest: Record<string, unknown> = { ...props };
    delete rest["component"];
    return untrack(() => (typeof C === "string" ? h(C, rest) : h(C as Component<Record<string, unknown>>, rest)));
  };
}
