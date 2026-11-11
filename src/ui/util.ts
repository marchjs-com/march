// Small helpers shared by the ui components.
import { onCleanup, getOwner } from "../core/reactive.ts";
import { h } from "../dom/h.ts";

/** A value or an accessor for it (signal, getter thunk, zero-arg function). */
export type MaybeFn<T> = T | (() => T);
/** Class input accepted by cx(): strings, arrays, `{ name: bool }` objects and falsy values. */
export type ClassValue = string | false | null | undefined | readonly ClassValue[] | { readonly [name: string]: unknown };
/** A `class` prop: a class value or an accessor for one. */
export type ClassProp = MaybeFn<ClassValue>;

/** Read a value-like prop that may be an accessor (signal, getter thunk, zero-arg function). */
export const val = <T>(v: MaybeFn<T>): T => (typeof v === "function" && !v.length ? (v as () => T)() : (v as T));

/** Join classes from strings, arrays, objects ({ name: bool }) and falsy values. */
export function cx(...parts: unknown[]): string {
  const out: string[] = [];
  const add = (p: unknown): void => {
    if (!p) return;
    if (typeof p === "string") out.push(p);
    else if (Array.isArray(p)) p.forEach(add);
    else if (typeof p === "object") for (const k in p) if ((p as Record<string, unknown>)[k]) out.push(k);
  };
  parts.forEach(add);
  return out.join(" ");
}

/**
 * Forward the props a component does not consume to its root element. Getters (live props from compiled JSX) become
 * thunks so they stay reactive; `class` is left out (components merge it themselves).
 */
export function rest(props: object, used: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = props as Record<string, unknown>;
  for (const k of Object.keys(src)) {
    if (used.includes(k) || k === "children" || k === "class" || k === "className") continue;
    const d = Object.getOwnPropertyDescriptor(src, k);
    out[k] = d?.get ? () => src[k] : src[k];
  }
  return out;
}

let seq = 0;
/** Unique DOM id. */
export const uid = (p = "hm"): string => `${p}-${(++seq).toString(36)}`;

/** localStorage JSON read/write; never throws (private mode, blocked storage, bad JSON). */
export function load<T>(key: string, fallback: T): T {
  try { const s = globalThis.localStorage?.getItem(key); return s == null ? fallback : JSON.parse(s) as T; } catch { return fallback; }
}
export function save(key: string, value: unknown): void {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

/** Add a DOM listener and remove it with the current owner. */
export function on<E extends Event = Event>(target: EventTarget | null | undefined, type: string, fn: (e: E) => void, opts?: boolean | AddEventListenerOptions): () => void {
  if (typeof target?.addEventListener !== "function") return () => {};
  const listener = fn as unknown as EventListener;
  target.addEventListener(type, listener, opts);
  const off = (): void => target?.removeEventListener(type, listener, opts);
  if (getOwner()) onCleanup(off);
  return off;
}

/** setTimeout that is cleared with the owner. */
export function later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(fn, ms);
  if (getOwner()) onCleanup(() => clearTimeout(id));
  return id;
}

/** A debounced function; `.cancel()` stops a pending call. */
export interface Debounced<A extends unknown[]> { (...a: A): void; cancel(): void }
/** Debounce; `.cancel()` stops a pending call. */
export function debounce<A extends unknown[]>(fn: (...a: A) => unknown, ms: number): Debounced<A> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const d = ((...a: A) => { clearTimeout(id); id = setTimeout(() => { id = undefined; fn(...a); }, ms); }) as Debounced<A>;
  d.cancel = () => { clearTimeout(id); id = undefined; };
  return d;
}

export const doc = (): Document => globalThis.document;

/** Render an icon prop: a string (emoji, ligature, short text) becomes an aria-hidden span; nodes pass through. */
export function icon(x: unknown, cls = "hm-icon"): unknown {
  if (x == null || x === false) return null;
  return typeof x === "string" ? h("span", { class: cls, "aria-hidden": "true" }, x) : x;
}
