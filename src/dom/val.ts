// Flow props (when, each, for) accept a value, a signal or any function returning the value; user render functions are
// called, reactive accessors (compiler thunks, signals) stay live regions. Its own module: For, Switch and Await use these
// two without loading If / Try (dom/flow.ts).
import { isReactive } from "../core/reactive.ts";

/** A value, a signal or any function returning the value. */
export type MaybeFn<T> = T | (() => T);
export const val = <T>(v: MaybeFn<T>): T => (typeof v === "function" ? (v as () => T)() : v);
export const call = (c: unknown, ...a: unknown[]): unknown => (typeof c === "function" && !isReactive(c) ? (c as (...x: unknown[]) => unknown)(...a) : c);
