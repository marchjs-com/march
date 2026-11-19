// Call scopes: who is calling? A device or network emulator that shares the page with what it emulates (a preview
// drawn into the same document) changes navigator.onLine, document.visibilityState, fetch… only for the emulated code.
// A scope looks at the call stack: `(stack) => /blob:/.test(stack)` is "code loaded from a blob: module".
//   const undo = overrideGetter(navigator, "onLine", () => false, scope)   // the preview reads false, the page its own
/** Is the current call inside the emulated code? Gets the call stack. */
export type CallScope = (stack: string) => boolean;

/** True when the current call matches the scope (no scope: every call does). */
export const inScope = (scope: CallScope | null | undefined): boolean => !scope || scope(new Error().stack ?? "");

/** Replace a getter on `obj` (an instance: navigator, document, screen.orientation…) for calls in the scope; the others
 *  read the real value. Returns the undo (the last one undone restores the original). */
export function overrideGetter<T extends object>(obj: T | null | undefined, key: string, get: () => unknown, scope?: CallScope | null): () => void {
  if (obj == null) return () => {}; // not in this environment (a test DOM without navigator)
  const own = Object.getOwnPropertyDescriptor(obj, key);
  let proto: object | null = obj, base: PropertyDescriptor | undefined = own;
  while (!base && (proto = Object.getPrototypeOf(proto))) base = Object.getOwnPropertyDescriptor(proto, key);
  const real = (): unknown => (base?.get ? base.get.call(obj) : base?.value);
  try {
    Object.defineProperty(obj, key, { configurable: true, enumerable: true, get: () => (inScope(scope) ? get() : real()) });
  } catch { return () => {}; }
  return () => { try { if (own) Object.defineProperty(obj, key, own); else delete (obj as Record<string, unknown>)[key]; } catch { /* sealed */ } };
}
