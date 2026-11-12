// Optional Web Components: `define("hm-counter", Counter, { props: ["start"] })` turns a component into a custom element.
// Attributes listed in `props` become live props (strings). Light DOM by default; `{ shadow: true }` attaches an open shadow root.
import { signal, createRoot, type Signal } from "../core/reactive.ts";
import { h, type Component } from "./h.ts";
import { render } from "./render.ts";

/** Props a custom element passes to its component: each observed attribute (string | null) plus `host`. */
export type DefineProps<K extends string> = { readonly [P in K]: string | null } & { host: HTMLElement };
export interface DefineOptions<K extends string> { props?: readonly K[]; shadow?: boolean }

/** Register a March component as a custom element (`<my-tag>`), with observed props and optional shadow DOM. */
export function define<K extends string = never>(tag: string, Comp: Component<DefineProps<K>>, { props = [], shadow = false }: DefineOptions<K> = {}): CustomElementConstructor {
  if (!/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(tag)) throw new Error(`March: "${tag}" is not a valid custom element name.`);
  const existing = globalThis.customElements?.get(tag);
  if (existing) return existing;
  class MarchElement extends HTMLElement {
    static get observedAttributes(): readonly K[] { return props; }
    _sig: Record<string, Signal<string | null>>;
    _dispose: (() => void) | null | undefined;
    constructor() {
      super();
      this._sig = Object.fromEntries(props.map((p) => [p, signal(this.getAttribute(p))]));
    }
    connectedCallback(): void {
      if (this._dispose) return;
      const root = shadow ? (this.shadowRoot ?? this.attachShadow({ mode: "open" })) : this;
      const live: Record<string, unknown> = {};
      for (const p of props) Object.defineProperty(live, p, { get: this._sig[p] as Signal<string | null>, enumerable: true });
      live["host"] = this;
      this._dispose = render(() => h(Comp, live as DefineProps<K>), root);
    }
    disconnectedCallback(): void { this._dispose?.(); this._dispose = null; }
    attributeChangedCallback(name: string, _old: string | null, value: string | null): void { this._sig[name]?.set(value); }
  }
  void createRoot;
  customElements.define(tag, MarchElement);
  return MarchElement;
}
