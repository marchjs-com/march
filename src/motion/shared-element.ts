// Shared element transition: one element seems to travel into its place in the next view (a project card's picture
// growing into the detail page's hero). Where View Transitions exist the browser morphs the two snapshots on the
// compositor (both get the same view-transition-name through CSSOM); elsewhere the new element is FLIP-animated from the
// old one's box by the motion engine. Reduced motion and "pause all" just swap the views.
//   await sharedTransition("project", cardImage, () => { $open = project })   // target: [data-hm-shared="project"]
import { setStyle } from "../core/util.ts";
import { viewTransition } from "./engine/motion.ts";
import { animate } from "./engine/playback.ts";
import { reducedNow } from "./engine/prefs.ts";
import { pausedNow } from "./engine/config.ts";

const find = (name: string): HTMLElement | null => globalThis.document?.querySelector<HTMLElement>(`[data-hm-shared="${globalThis.CSS?.escape?.(name) ?? name}"]`) ?? null;

/**
 * Run `update` (which renders the next view) so that `from` morphs into the element marked `data-hm-shared={name}` in
 * the new view. Resolves when the transition has finished.
 */
export async function sharedTransition(name: string, from: Element | null, update: () => void | Promise<void>, o: { duration?: number } = {}): Promise<void> {
  const doc = globalThis.document as Document & { startViewTransition?: unknown };
  const vtName = `hm-shared-${name.replace(/[^\w-]/g, "")}`;
  if (!from || reducedNow() || pausedNow()) { await update(); return; }
  if (typeof doc?.startViewTransition === "function") {
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
  // FLIP: the new element starts in the old one's box and grows into its own
  const a = from.getBoundingClientRect();
  await update();
  const to = find(name);
  if (!to) return;
  const b = to.getBoundingClientRect();
  if (!b.width || !b.height) return;
  const tf = `translate(${(a.left - b.left).toFixed(1)}px, ${(a.top - b.top).toFixed(1)}px) scale(${(a.width / b.width).toFixed(4)}, ${(a.height / b.height).toFixed(4)})`;
  setStyle(to, { "transform-origin": "0 0" });
  await animate(to, { transform: [tf, "translate(0px, 0px) scale(1, 1)"] }, { duration: o.duration ?? 560, easing: "expo" }).finished;
  setStyle(to, { "transform-origin": null });
}
