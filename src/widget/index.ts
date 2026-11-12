// Widget points: a named place in the UI that other code fills with providers.
// `const codeView = widgetPoint<CodeViewInput>("code-view", { defaults: [viewer, copy] })`
// `codeView.provide({ id: "my-editor", render: (input, ctx) => … })` → `<Widget sources={[codeView]} input={…} />`
// One "main" provider draws the body (highest `order`, the latest wins a tie, so a later provider replaces the
// default); every "action" provider adds a control that the main provider places with `ctx.actions()`.
// Kept small on purpose: the full contribution system grows with the messaging layer.
import { signal, computed, untrack, getOwner, onCleanup, type Accessor } from "../core/reactive.ts";
import { h } from "../dom/h.ts";

/** What a provider receives besides the input. */
export interface WidgetContext<P> {
  /** The point's action controls (Copy, Fullscreen, …), rendered for this input; place them in your toolbar. */
  actions: () => unknown[];
  /** The input given to `<Widget>`. */
  input: P;
}
/** A contribution to a widget point. */
export interface WidgetProvider<P> {
  id: string;
  /** "main" (default) draws the body; "action" adds a toolbar control. */
  slot?: "main" | "action";
  /** Higher wins for "main"; sort order for "action". Defaults are 0; a tie goes to the latest registered. */
  order?: number;
  /** Only used for inputs it accepts (for example only `lang: "tsx"`). */
  when?: (input: P) => boolean;
  render: (input: P, ctx: WidgetContext<P>) => unknown;
}
/** A named widget point. */
export interface WidgetPoint<P> {
  readonly id: string;
  /** Add a provider; returns the remove function (also removed with the current owner). */
  provide(p: WidgetProvider<P>): () => void;
  /** Registered providers (reactive): defaults first, then in registration order. */
  providers(): readonly WidgetProvider<P>[];
}

const points = new Map<string, WidgetPoint<never>>();

/** Create (or get, by id) a widget point. `defaults` are always present and lose ties to later providers. */
export function widgetPoint<P>(id: string, opts?: { defaults?: readonly WidgetProvider<P>[] }): WidgetPoint<P> {
  const known = points.get(id) as WidgetPoint<P> | undefined;
  if (known) return known;
  const list = signal<readonly WidgetProvider<P>[]>(opts?.defaults ?? [], { name: `widget:${id}` });
  const point: WidgetPoint<P> = {
    id,
    provide(p) {
      list.update((l) => [...l.filter((x) => x.id !== p.id), p]);
      const off = (): void => { list.update((l) => l.filter((x) => x !== p)); };
      if (getOwner()) onCleanup(off);
      return off;
    },
    providers: list,
  };
  points.set(id, point as WidgetPoint<never>);
  return point;
}

/** The main provider that `<Widget>` would draw for this input (exported for tests and tools). */
export function pickMain<P>(sources: readonly WidgetPoint<P>[], input: P): WidgetProvider<P> | undefined {
  let best: WidgetProvider<P> | undefined;
  for (const s of sources) for (const p of s.providers()) {
    if ((p.slot ?? "main") !== "main" || (p.when && !p.when(input))) continue;
    if (!best || (p.order ?? 0) >= (best.order ?? 0)) best = p;
  }
  return best;
}
function actionsOf<P>(sources: readonly WidgetPoint<P>[], input: P): WidgetProvider<P>[] {
  const out: WidgetProvider<P>[] = [];
  for (const s of sources) for (const p of s.providers()) if (p.slot === "action" && (!p.when || p.when(input))) out.push(p);
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export interface WidgetProps<P> { sources: readonly WidgetPoint<P>[]; input: P; class?: string }
/** Draw a widget point: `<Widget sources={[codeView]} input={{ source, lang: "tsx" }} />`. */
export function Widget<P>(props: WidgetProps<P>): Element {
  const input = props.input;
  const main: Accessor<WidgetProvider<P> | undefined> = computed(() => pickMain(props.sources, input));
  const actions = computed(() => actionsOf(props.sources, input));
  const ctx: WidgetContext<P> = { input, actions: () => actions().map((a) => untrack(() => a.render(input, ctx))) };
  return h("div", { class: props.class ? `hm-widget ${props.class}` : "hm-widget", "data-widget": () => main()?.id ?? "" },
    () => { const m = main(); return m ? untrack(() => m.render(input, ctx)) : null; });
}
