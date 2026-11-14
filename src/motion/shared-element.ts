// Shared element across a view change: one element seems to travel into its place in the next view (a project card's
// picture growing into the detail page's cover) although the old view is gone once the new one renders. Where View
// Transitions exist the browser morphs the two snapshots (the engine's viewTransition, both get the same
// view-transition-name through CSSOM). Elsewhere a stand-in of the old element is kept in the fx layer for the moment of
// the swap and morph(…, { mode: "scale" }) (motion/morph.ts) grows the new element out of it. Reduced motion and "pause
// all" just swap the views.
//   await sharedTransition("project-7", cardCover, () => { $open = project })   // target: [data-m-shared="project-7"]
import { setStyle } from "../core/util.ts";
import { openLayer } from "../dom/portal.ts";
import { viewTransition } from "./engine/motion.ts";
import { reducedNow } from "./engine/prefs.ts";
import { pausedNow } from "./engine/config.ts";
import { morph } from "./morph.ts";

const find = (name: string): HTMLElement | null => globalThis.document?.querySelector<HTMLElement>(`[data-m-shared="${globalThis.CSS?.escape?.(name) ?? name}"]`) ?? null;

/**
 * Run `update` (which renders the next view) so that `from` morphs into the element marked `data-m-shared={name}` in
 * the new view. Resolves when the transition has finished.
 */
export async function sharedTransition(name: string, from: Element | null, update: () => void | Promise<void>, o: { duration?: number } = {}): Promise<void> {
  const doc = globalThis.document as Document & { startViewTransition?: unknown };
  if (!from || reducedNow() || pausedNow()) { await update(); return; }
  if (typeof doc?.startViewTransition === "function") {
    const vtName = `m-shared-${name.replace(/[^\w-]/g, "")}`;
    setStyle(from as HTMLElement, { "view-transition-name": vtName });
    let to: HTMLElement | null = null;
    await viewTransition(async () => {
      setStyle(from as HTMLElement, { "view-transition-name": null });
      await update();
      to = find(name);
      setStyle(to, { "view-transition-name": vtName });
    });
    setStyle(to, { "view-transition-name": null });
    return;
  }
  // a stand-in at the old place, in the fx layer, so morph has a source box after the old view is gone
  const r = from.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.removeAttribute("data-m-shared");
  setStyle(ghost, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: "0", "pointer-events": "none" });
  const close = openLayer("fx", ghost);
  try {
    await update();
    const to = find(name);
    if (to) await morph(ghost, to, { mode: "scale", duration: o.duration ?? 560, easing: "expo" }).finished;
  } finally { close(); }
}
