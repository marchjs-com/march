// A page-wide restyle (color theme, light / dark, accent) lands in one step; a transition (the theme wave of
// hadi-march/motion) can be put around it. Its own tiny module: the theme code and the motion helper both import it,
// neither imports the other.

/** Runs a restyle: `apply` writes the new look (call it once, now or inside a View Transition). */
export type RestyleTransition = (apply: () => void) => void;
let around: RestyleTransition | null = null;

/**
 * Put a transition around every page-wide restyle (setTheme, setColorTheme, setAccent): `(apply) => …` must call
 * `apply` once. `null` removes it. Returns a function that removes this one. `installThemeWave()` (hadi-march/motion)
 * uses it to reveal the new look as a circle that grows from the pressed point.
 */
export function setRestyleTransition(fn: RestyleTransition | null): () => void {
  around = fn;
  return () => { if (around === fn) around = null; };
}

/**
 * Apply a page-wide restyle (color theme, light/dark, accent) in one step. Without this every element with a color or
 * shadow transition starts its own transition at once — hundreds on a real page — and the browser stalls for a few
 * hundred ms. Transitions are off for the one style pass that takes the new values, then back on.
 */
export function restyleInstantly(change: () => void): void {
  const root = globalThis.document?.documentElement;
  if (!root) { change(); return; }
  const apply = (): void => {
    root.setAttribute("data-m-restyling", "");
    change();
    globalThis.getComputedStyle?.(root).getPropertyValue("color"); // the new values land while transitions are off
    setTimeout(() => root.removeAttribute("data-m-restyling"), 0);
  };
  if (!around) { apply(); return; }
  // a transition that fails to run the change must not lose it
  let done = false;
  const once = (): void => { if (!done) { done = true; apply(); } };
  try { around(once); } catch { once(); }
}
