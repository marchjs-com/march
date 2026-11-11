// Optional Web Components: `define("hm-counter", Counter, { props: ["start"] })` turns a component into a custom element.
// Attributes listed in `props` become live props (strings). Light DOM by default; `{ shadow: true }` attaches an open shadow root.
import { signal, createRoot } from "../core/reactive.js";
import { h } from "./h.js";
import { render } from "./render.js";

export function define(tag, Comp, { props = [], shadow = false } = {}) {
  if (!/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(tag)) throw new Error(`March: "${tag}" is not a valid custom element name.`);
  if (globalThis.customElements?.get(tag)) return customElements.get(tag);
  class MarchElement extends HTMLElement {
    static get observedAttributes() { return props; }
    constructor() {
      super();
      this._sig = Object.fromEntries(props.map((p) => [p, signal(this.getAttribute(p))]));
    }
    connectedCallback() {
      if (this._dispose) return;
      const root = shadow ? (this.shadowRoot ?? this.attachShadow({ mode: "open" })) : this;
      const live = {};
      for (const p of props) Object.defineProperty(live, p, { get: this._sig[p], enumerable: true });
      live.host = this;
      this._dispose = render(() => h(Comp, live), root);
    }
    disconnectedCallback() { this._dispose?.(); this._dispose = null; }
    attributeChangedCallback(name, _old, value) { this._sig[name]?.set(value); }
  }
  void createRoot;
  customElements.define(tag, MarchElement);
  return MarchElement;
}
