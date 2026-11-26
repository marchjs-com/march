// March — DOM creation without a virtual DOM (TypeScript).
// `h(tag, props, ...children)` creates real nodes once. A function (signal, computed, compiler thunk) placed in a child or
// attribute position becomes a live binding: only that text node / attribute / region updates when its signals change.
// Security: no HTML strings ever (no innerHTML), URL attributes are sanitized, <script> cannot be created, Trusted Types safe.
// The parts live in their own modules (a CDN page loads the ones it uses): children dom/insert.ts, events dom/events.ts,
// templates and plain props dom/tpl.ts, every prop kind dom/props.ts, components dom/component.ts. This module is h()
// and the names of all of them.
import { insert, doc, type MarchEl } from "./insert.ts";
import { setProp } from "./props.ts";
import { createComponent, type Component } from "./component.ts";
export * from "./insert.ts";
export * from "./events.ts";
export * from "./tpl.ts";
export * from "./props.ts";
export * from "./component.ts";

/** Anything h() can render. Functions are live regions. */
export type Child = Node | string | number | bigint | boolean | null | undefined | readonly Child[] | (() => unknown);
type Props = Record<string, unknown>;

const SVG_NS = "http://www.w3.org/2000/svg";
/** Tags created in the SVG namespace (add more with `SVG_TAGS.add`). */
export const SVG_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "tspan", "defs",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "use", "symbol", "title", "desc", "marker", "foreignObject"]);
const FORBIDDEN_TAGS = new Set(["script", "iframe", "object", "embed", "base", "meta"]);

/** Create an element (string tag) or render a component. */
export function h<P extends object>(type: Component<P>, props: P | null, ...children: unknown[]): unknown;
export function h(type: string, props?: Props | null, ...children: unknown[]): Element;
export function h(type: string | Component<never>, props?: Props | null, ...children: unknown[]): unknown {
  const p: Props = props ?? {};
  if (typeof type === "function") return createComponent(type as Component<Props>, p, children);
  if (typeof type !== "string") throw new TypeError("March: h() needs a tag name or a component.");
  if (FORBIDDEN_TAGS.has(type)) throw new Error(`March: <${type}> cannot be created (security).`);
  const el = (SVG_TAGS.has(type) ? doc().createElementNS(SVG_NS, type) : doc().createElement(type)) as MarchEl;
  for (const key in p) if (key !== "children") setProp(el, type, key, p[key]);
  const kids = children.length ? children : p["children"];
  if (kids != null) insert(el, kids);
  return el;
}

