// ExplodedView (hadi-march/ui): takes what it holds apart, like an exploded drawing, and puts it back. The content is
// never drawn again: the SAME elements tilt and lift (CSS `translate` on them, so their own transforms keep working).
//   - with `parts` (selectors inside the content): each matching element rises as a plate with a name tag;
//   - without: the layers of one element (the first one, or `target`): its shadow, its surface, its content and its
//     focus ring. The shadow, surface and ring plates are plain boxes that copy the element's computed look.
// Elements are marked with data-m-xv attributes (a component that rewrites its class keeps them) and marked again
// when the content changes while it is apart.
import "./exploded-view.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { model } from "../../../forms/util.ts";
import { observeSize } from "../../../ui/observe.ts";
import { type ColorToken } from "../../../theme/colors.ts";

messages("tr", { "Shadow": "Gölge", "Surface": "Zemin", "Content": "İçerik", "Focus ring": "Odak halkası", "Exploded view": "Parçalarına ayrılmış görünüm" });

/** A part of the content that rises as its own plate. */
export interface ExplodedPart {
  /** Which elements inside the content (every match is a plate). */
  selector: string;
  /** The name on the tag (default: no tag). */
  label?: string;
  /** Given to `onPick` and compared with `active` (default: the label, else the selector). */
  id?: string;
  /** How many steps it rises above the plate it sits on (default 1). */
  level?: number;
}
/** The layers of one element. */
export type ExplodedLayer = "shadow" | "surface" | "content" | "ring";

export interface ExplodedViewProps {
  /** Apart or together: a signal, a value / accessor, or `bind:open`. */
  open?: MaybeFn<boolean | undefined>;
  setOpen?: ((v: boolean) => void) | undefined;
  /** Elements that rise as plates (reactive). Without it: the layers of one element. */
  parts?: MaybeFn<readonly ExplodedPart[] | undefined>;
  /** Layers mode: the element taken apart, a selector inside the content (default: the first element). */
  target?: MaybeFn<string | undefined>;
  /** Layers mode: the name of a layer, or false to leave that layer out (defaults: Shadow, Surface, Content, Focus ring; translated). */
  layers?: Partial<Record<ExplodedLayer, string | false>> | undefined;
  /** The name tags (default true). */
  tags?: MaybeFn<boolean | undefined>;
  /** Distance between two plates, px (default 26). */
  gap?: MaybeFn<number | undefined>;
  /** The tilt, degrees: `x` leans it back (default 52), `z` turns it (default -30; mirrored in RTL). */
  tilt?: { x?: number; z?: number } | undefined;
  /** The content is scaled down so its longer side is at most this many px when apart (default 420); false: never scaled. */
  fit?: number | false | undefined;
  /** How it moves: "smooth" (default), "spring" or "none" / false. */
  motion?: "smooth" | "spring" | "none" | false | undefined;
  /** A plate was pressed while apart (the press does not reach the content). */
  onPick?: ((id: string, el: Element) => void) | undefined;
  /** The plate shown as chosen (reactive): an `id`. */
  active?: MaybeFn<string | null | undefined>;
  /** Accessible name of the group while apart (default "Exploded view", translated). */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
  children?: unknown;
}

interface Tag { id: string; label: string; x: number; y: number; z: number }
interface Ghost { kind: "shadow" | "surface" | "ring"; label: string | null; x: number; y: number; w: number; h: number; z: number; style: Record<string, string> }

const MARKS = ["data-m-xv", "data-m-xv-id", "data-m-xv-through", "data-m-xv-on"];

/** `<ExplodedView bind:open={$apart} parts={[{ selector: ".m-avatar", label: "Avatar" }]}><PostCard … /></ExplodedView>` */
export function ExplodedView(props: ExplodedViewProps): Element {
  const [isOpen] = model<boolean>(props, false, "open");
  const tags = signal<Tag[]>([]), ghosts = signal<Ghost[]>([]), scale = signal(1);
  // the room the tilted stack takes, as margins around the (unchanged) layout box: [block start, block end, inline]
  const room = signal<[number, number, number]>([0, 0, 0]);
  const rx = (): number => props.tilt?.x ?? 52, rz = (): number => props.tilt?.z ?? -30;
  // `moving`: the plates are marked (apart, or on the way back); `shown`: they are lifted
  const moving = signal(false), shown = signal(false);
  const gap = (): number => val(props.gap) ?? 26;
  let body!: HTMLElement, tilt!: HTMLElement;

  /** An element's box inside the tilted box, in layout px (transforms do not change it). */
  const boxOf = (el: HTMLElement): { x: number; y: number; w: number; h: number } => {
    let x = 0, y = 0;
    for (let n: HTMLElement | null = el; n && n !== tilt; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft || 0; y += n.offsetTop || 0; }
    return { x, y, w: el.offsetWidth || 0, h: el.offsetHeight || 0 };
  };
  const clear = (): void => {
    for (const el of body.querySelectorAll<HTMLElement>("[data-m-xv], [data-m-xv-through]")) { for (const a of MARKS) el.removeAttribute(a); el.style?.removeProperty("--m-xv-i"); }
  };
  const through = (el: Element): void => { for (let n = el.parentElement; n && n !== body; n = n.parentElement) n.setAttribute("data-m-xv-through", ""); };

  /** Mark the plates and measure the tags and ghost plates (cheap: runs on mount, on a change of the content, on resize). */
  const scan = (): void => {
    if (!body) return;
    clear();
    const outTags: Tag[] = [], outGhosts: Ghost[] = [];
    const parts = val(props.parts);
    let top = 1;
    if (parts?.length) {
      const marked: HTMLElement[] = [];
      for (const p of parts) {
        let found: HTMLElement[] = [];
        try { found = [...body.querySelectorAll<HTMLElement>(p.selector)]; } catch { /* a bad selector marks nothing */ }
        for (const el of found) {
          if (el.hasAttribute("data-m-xv")) continue;
          el.setAttribute("data-m-xv", "part");
          el.setAttribute("data-m-xv-id", p.id ?? p.label ?? p.selector);
          el.style?.setProperty("--m-xv-i", String(p.level ?? 1));
          through(el);
          marked.push(el);
        }
      }
      // a plate inside a plate rises on top of it: the tag sits at the sum
      for (const el of marked) {
        let z = 0;
        for (let n: HTMLElement | null = el; n && n !== body; n = n.parentElement) if (n.getAttribute("data-m-xv") === "part") z += Number(n.style?.getPropertyValue("--m-xv-i")) || 1;
        top = Math.max(top, z);
        const id = el.getAttribute("data-m-xv-id")!, label = parts.find((p) => (p.id ?? p.label ?? p.selector) === id)?.label;
        if (label) { const b = boxOf(el); outTags.push({ id, label, x: b.x, y: b.y, z }); }
      }
    } else {
      const sel = val(props.target);
      let el: HTMLElement | null = null;
      try { el = sel ? body.querySelector<HTMLElement>(sel) : body.firstElementChild as HTMLElement | null; } catch { el = null; }
      if (el) {
        const names = props.layers ?? {};
        const name = (k: ExplodedLayer, d: string): string | false => (names[k] === undefined ? d : names[k]!);
        // the element's real look: its own transitions are off for the read (it was see-through a moment ago)
        el.style?.setProperty("transition", "none");
        const live = globalThis.getComputedStyle?.(el), b = boxOf(el);
        const cs = live ? { borderRadius: live.borderRadius, boxShadow: live.boxShadow, backgroundColor: live.backgroundColor, backgroundImage: live.backgroundImage, borderTopStyle: live.borderTopStyle, borderTopWidth: live.borderTopWidth, borderTopColor: live.borderTopColor } : null;
        el.style?.removeProperty("transition");
        const radius = cs?.borderRadius || "0px";
        const levels: ExplodedLayer[] = [];
        const shadow = name("shadow", t`Shadow`), surface = name("surface", t`Surface`), content = name("content", t`Content`), ring = name("ring", t`Focus ring`);
        if (shadow !== false && cs && cs.boxShadow && cs.boxShadow !== "none") { levels.push("shadow"); outGhosts.push({ kind: "shadow", label: shadow, ...b, z: levels.length - 1, style: { "border-radius": radius, "box-shadow": cs.boxShadow } }); }
        if (surface !== false) {
          levels.push("surface");
          outGhosts.push({ kind: "surface", label: surface, ...b, z: levels.length - 1, style: cs ? { "border-radius": radius, "background-color": cs.backgroundColor, "background-image": cs.backgroundImage, "border-style": cs.borderTopStyle, "border-width": cs.borderTopWidth, "border-color": cs.borderTopColor } : {} });
        }
        if (content !== false) {
          levels.push("content");
          el.setAttribute("data-m-xv", surface !== false ? "content" : "whole");
          el.setAttribute("data-m-xv-id", "content");
          el.style?.setProperty("--m-xv-i", String(levels.length - 1));
          through(el);
          outTags.push({ id: "content", label: content, x: b.x + b.w, y: b.y + b.h / 2, z: levels.length - 1 });
        }
        if (ring !== false) { levels.push("ring"); outGhosts.push({ kind: "ring", label: ring, ...b, z: levels.length - 1, style: { "border-radius": radius } }); }
        top = Math.max(1, levels.length - 1);
      }
    }
    // the box the tilted content covers on screen: turned (z), leaned back (x), scaled; the plates rise above it
    const w = tilt.offsetWidth || 0, hh = tilt.offsetHeight || 0, fit = props.fit === false ? 0 : props.fit ?? 420, long = Math.max(w, hh);
    const k = fit && long > fit ? fit / long : 1, rad = Math.PI / 180;
    const sin = Math.abs(Math.sin(rz() * rad)), cos = Math.abs(Math.cos(rz() * rad)), lean = Math.cos(rx() * rad);
    const seenW = (w * cos + hh * sin) * k, seenH = (w * sin + hh * cos) * lean * k, lift = top * untrack(gap) * Math.sin(rx() * rad) * k;
    untrack(() => { tags.set(outTags); ghosts.set(outGhosts); scale.set(k); room.set([(seenH - hh) / 2 + lift, (seenH - hh) / 2, (seenW - w) / 2]); });
  };

  let queued = false;
  const rescan = (): void => {
    if (queued || !untrack(moving)) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (untrack(moving)) scan(); });
  };

  const pick = (e: Event): void => {
    if (!untrack(isOpen)) return;
    const plate = (e.target as Element | null)?.closest?.("[data-m-xv-id]");
    // apart, the content does not take presses: a plate is picked instead
    e.preventDefault(); e.stopPropagation();
    if (plate && root.contains(plate)) props.onPick?.(plate.getAttribute("data-m-xv-id")!, plate);
  };

  const tagEl = (g: Tag): Element => h("span", {
    class: () => cx("m-xv-tag", val(props.active) === g.id && "is-active"), "data-m-xv-id": g.id,
    style: { "inset-inline-start": `${g.x}px`, "inset-block-start": `${g.y}px`, "--m-xv-i": String(g.z) },
  }, g.label);
  const ghostEl = (g: Ghost): Element => h("span", {
    class: () => cx("m-xv-ghost", `m-xv-${g.kind}`, val(props.active) === g.kind && "is-active"), "data-m-xv-id": g.kind,
    style: { ...g.style, "inset-inline-start": `${g.x}px`, "inset-block-start": `${g.y}px`, "inline-size": `${g.w}px`, "block-size": `${g.h}px`, "--m-xv-i": String(g.z) },
  }, g.label != null && val(props.tags) !== false ? h("span", { class: "m-xv-tag m-xv-tag-side" }, g.label) : null);

  body = h("div", { class: "m-xv-body" }, props.children) as HTMLElement;
  tilt = h("div", { class: "m-xv-tilt" }, body,
    h("div", { class: "m-xv-plates", "aria-hidden": "true" }, () => ghosts().map(ghostEl), () => (val(props.tags) === false ? null : tags().map(tagEl)))) as HTMLElement;
  const motion = (): string => (props.motion === false ? "none" : props.motion ?? "smooth");
  const root = h("div", {
    class: () => cx("m-xv", moving() && "is-moving", shown() && "is-open", val(props.parts)?.length ? "m-xv-parts" : "m-xv-layers", `m-xv-${motion()}`, val(props.class)),
    role: () => (isOpen() ? "group" : null), "aria-label": () => (isOpen() ? val(props.label) ?? t`Exploded view` : null),
    style: () => { const [top, bottom, side] = room(); return { "--m-xv-gap": `${gap()}px`, "--m-xv-scale": String(scale()), "--m-xv-rx": `${rx()}deg`, "--m-xv-rz": `${rz()}deg`, "--m-xv-top": `${Math.round(top)}px`, "--m-xv-bottom": `${Math.round(bottom)}px`, "--m-xv-side": `${Math.round(side)}px` }; },
    "on:click|capture": pick, "on:pointerdown|capture": (e: Event) => { if (untrack(isOpen)) e.stopPropagation(); },
  }, tilt) as HTMLElement;

  // the chosen part lights up (a plate inside the content: an attribute, so the content's own classes stay)
  effect(() => {
    const id = val(props.active); tags();
    for (const el of body.querySelectorAll("[data-m-xv-on]")) el.removeAttribute("data-m-xv-on");
    if (id) for (const el of body.querySelectorAll(`[data-m-xv-id]`)) if (el.getAttribute("data-m-xv-id") === id) el.setAttribute("data-m-xv-on", "");
  });
  // apart: mark the plates where they are, then lift them (the style pass in between makes the lift a transition);
  // together: lower them, and take the marks off when they have landed
  let landing: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    const on = isOpen();
    untrack(() => {
      clearTimeout(landing);
      if (on) {
        moving.set(true); scan();
        void root.offsetWidth;
        shown.set(true);
      } else if (moving.peek()) {
        shown.set(false);
        // as long as the tilt's own transition (reduced motion: next to nothing)
        const ms = motion() === "none" ? 0 : (parseFloat(globalThis.getComputedStyle?.(tilt).transitionDuration ?? "") || 0.72) * 1000;
        landing = setTimeout(() => { moving.set(false); clear(); tags.set([]); ghosts.set([]); }, ms);
      }
    });
  });
  onCleanup(() => clearTimeout(landing));
  // the parts changed while it is apart
  effect(() => { val(props.parts); val(props.target); rescan(); });
  const MO = globalThis.MutationObserver;
  if (typeof MO === "function") {
    const mo = new MO((list) => { if (list.some((m) => m.type === "childList" || !MARKS.includes(m.attributeName ?? ""))) rescan(); });
    mo.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
    onCleanup(() => mo.disconnect());
  }
  observeSize(body, rescan);
  return root;
}
