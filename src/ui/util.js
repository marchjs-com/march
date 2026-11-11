// Small helpers shared by the ui components.
import { onCleanup, getOwner } from "../core/reactive.ts";

/** Read a value-like prop that may be an accessor (signal, getter thunk, zero-arg function). */
export const val = (v) => (typeof v === "function" && !v.length ? v() : v);

/** Join classes from strings, arrays, objects ({ name: bool }) and falsy values. */
export function cx(...parts) {
  const out = [];
  const add = (p) => {
    if (!p) return;
    if (typeof p === "string") out.push(p);
    else if (Array.isArray(p)) p.forEach(add);
    else if (typeof p === "object") for (const k in p) if (p[k]) out.push(k);
  };
  parts.forEach(add);
  return out.join(" ");
}

/**
 * Forward the props a component does not consume to its root element. Getters (live props from compiled JSX) become
 * thunks so they stay reactive; `class` is left out (components merge it themselves).
 */
export function rest(props, used) {
  const out = {};
  for (const k of Object.keys(props)) {
    if (used.includes(k) || k === "children" || k === "class" || k === "className") continue;
    const d = Object.getOwnPropertyDescriptor(props, k);
    out[k] = d.get ? () => props[k] : props[k];
  }
  return out;
}

let seq = 0;
/** Unique DOM id. */
export const uid = (p = "hm") => `${p}-${(++seq).toString(36)}`;

/** localStorage JSON read/write; never throws (private mode, blocked storage, bad JSON). */
export function load(key, fallback) {
  try { const s = globalThis.localStorage?.getItem(key); return s == null ? fallback : JSON.parse(s); } catch { return fallback; }
}
export function save(key, value) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

/** Add a DOM listener and remove it with the current owner. */
export function on(target, type, fn, opts) {
  if (typeof target?.addEventListener !== "function") return () => {};
  target.addEventListener(type, fn, opts);
  const off = () => target?.removeEventListener(type, fn, opts);
  if (getOwner()) onCleanup(off);
  return off;
}

/** setTimeout that is cleared with the owner. */
export function later(fn, ms) {
  const id = setTimeout(fn, ms);
  if (getOwner()) onCleanup(() => clearTimeout(id));
  return id;
}

/** Debounce; `.cancel()` stops a pending call. */
export function debounce(fn, ms) {
  let id = null;
  const d = (...a) => { clearTimeout(id); id = setTimeout(() => { id = null; fn(...a); }, ms); };
  d.cancel = () => { clearTimeout(id); id = null; };
  return d;
}

export const doc = () => globalThis.document;

import { h } from "../dom/h.js";
/** Render an icon prop: a string (emoji, ligature, short text) becomes an aria-hidden span; nodes pass through. */
export function icon(x, cls = "hm-icon") {
  if (x == null || x === false) return null;
  return typeof x === "string" ? h("span", { class: cls, "aria-hidden": "true" }, x) : x;
}
