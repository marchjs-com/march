// BranchingStory (hadi-march/landing): a choose-your-own-path story. Each passage ends in choices; the reader's path
// collects as a trail at the top (any step rewinds to it) and the endings found so far are counted. A pick lights the
// chosen button, fades the others and turns the page: the new passage swings in from the reading direction (back:
// from the other side), mirrored in RTL. Keys 1–9 pick a choice. Focus moves to the new passage's heading. The stage
// keeps a minimum height so the page does not jump between passages.
import "./branching-story.css";
import { h } from "../../../dom/h.ts";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { t, dir, messages } from "../../../core/i18n.ts";
import { cx, val, setStyle, listen, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface StoryChoice {
  label: unknown;
  /** Id of the passage it leads to. */
  to: string;
  /** Small text under the label: "10:00 · 5 km". */
  note?: unknown | undefined;
}
export interface StoryPassage {
  title?: unknown | undefined;
  body: unknown;
  media?: unknown | undefined;
  /** No choices: the passage is an ending. */
  choices?: StoryChoice[] | undefined;
  /** Name of the ending ("The new friend"), shown on an ending. */
  ending?: unknown | undefined;
  /** Accent of the passage. */
  color?: ColorToken | undefined;
}
export interface BranchingStoryProps {
  /** Passages by id. */
  passages: Record<string, StoryPassage>;
  /** Id of the first passage. */
  start: string;
  /** The path (passage ids from the start), to restore or drive it from outside. */
  path?: MaybeFn<string[]> | undefined;
  onChange?: ((path: string[]) => void) | undefined;
  /** Show the trail of choices (default true). */
  trail?: boolean | undefined;
  /** Count the endings found (default true). */
  endings?: boolean | undefined;
  /** Shown at an ending, next to "Start again" (a call to action). */
  action?: unknown | undefined;
  /** Minimum stage height (CSS length, default "20rem"): passages of different length do not move the page. */
  minHeight?: string | undefined;
  /** Accessible name (default "Story"). */
  label?: string | undefined;
  class?: ClassProp | undefined;
}

/** Every ending reachable from `start` (passages without choices), in reading order. */
export function storyEndings(passages: Record<string, StoryPassage>, start: string): string[] {
  const seen = new Set<string>(), out: string[] = [], queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !passages[id]) continue;
    seen.add(id);
    const p = passages[id]!;
    if (!p.choices?.length) out.push(id);
    else for (const c of p.choices) queue.push(c.to);
  }
  return out;
}

/** `<BranchingStory start="intro" passages={{ intro: { body: "…", choices: [{ label: "Go", to: "next" }] }, next: { body: "The end", ending: "Short" } }} />` */
export function BranchingStory(props: BranchingStoryProps): Element {
  const path = signal<string[]>(untrack(() => val(props.path)) ?? [props.start]);
  if (props.path !== undefined) effect(() => { const p = val(props.path); if (p?.length) path.set(p); });
  const all = storyEndings(props.passages, props.start);
  const found = signal<ReadonlySet<string>>(new Set());
  const current = computed(() => { const p = path(); return p[p.length - 1] ?? props.start; });
  let forward = true;
  const go = (next: string[]): void => {
    forward = next.length >= path.peek().length;
    path.set(next);
    const id = next[next.length - 1]!;
    if (!props.passages[id]?.choices?.length && !found.peek().has(id)) found.set(new Set([...found.peek(), id]));
    props.onChange?.(next);
  };

  // the trail: one step per choice made, labelled with the choice; a step rewinds the story to it
  const trail = props.trail === false ? null : h("nav", { class: "hm-bs-trail", "aria-label": () => t`Your path` },
    h("ol", { class: "hm-bs-steps" }, () => path().map((id, i, p) => {
      const prev = i ? props.passages[p[i - 1]!] : null;
      const via = prev?.choices?.find((c) => c.to === id)?.label ?? t`Start`;
      const last = i === p.length - 1;
      return h("li", { class: cx("hm-bs-step", last && "is-current") },
        last ? h("span", { "aria-current": "step" }, via) : h("button", { type: "button", onClick: () => go(p.slice(0, i + 1)) }, via));
    })),
    props.endings === false || !all.length ? null : h("span", { class: "hm-bs-found" }, () => t`Endings found: ${found().size} / ${all.length}`));

  const stage = h("div", { class: "hm-bs-stage" }) as HTMLElement;
  setStyle(stage, { "--hm-bs-min": props.minHeight ?? "20rem" });

  const pick = (btn: HTMLElement, to: string): void => {
    const done = (): void => go([...path.peek(), to]);
    if (reducedMotion()) { done(); return; }
    btn.classList.add("is-picked");
    btn.closest(".hm-bs-choices")?.classList.add("is-deciding");
    void animate(btn, { transform: ["scale(1)", "scale(1.04)", "scale(1)"] }, { duration: 320, easing: "out" }).finished.then(done);
  };

  const passage = (id: string): HTMLElement => {
    const p = props.passages[id] ?? { body: t`This part of the story is missing.` };
    const choices = p.choices ?? [];
    const heading = h("h3", { class: "hm-bs-title", tabindex: "-1" }, p.title ?? (choices.length ? "" : p.ending ?? t`The end`));
    return h("article", { class: cx("hm-bs-passage", !choices.length && "is-ending"), "data-hm-color": colorAttr(p.color) },
      p.media != null ? h("div", { class: "hm-bs-media" }, p.media) : null,
      h("div", { class: "hm-bs-copy" },
        !choices.length && p.ending != null && p.title != null ? h("span", { class: "hm-bs-ending" }, t`Ending: `, p.ending) : null,
        heading,
        h("div", { class: "hm-bs-body" }, p.body),
        choices.length
          ? h("ol", { class: "hm-bs-choices" }, ...choices.map((c, i) => h("li", null, h("button", {
            type: "button", class: "hm-bs-choice", "data-key": String(i + 1),
            onClick: (e: MouseEvent) => pick(e.currentTarget as HTMLElement, c.to),
          }, h("kbd", { class: "hm-bs-key", "aria-hidden": "true" }, String(i + 1)), h("span", { class: "hm-bs-choice-text" }, c.label, c.note != null ? h("small", null, c.note) : null)))))
          : h("div", { class: "hm-bs-end" },
            h("button", { type: "button", class: "hm-btn hm-btn-secondary", onClick: () => go([props.start]) }, () => t`Start again`),
            props.action ?? null))) as HTMLElement;
  };

  // page turn: the old passage leaves to one side, the new swings in from the other (reading direction, mirrored back)
  let shown: HTMLElement | null = null, first = true;
  effect(() => {
    const id = current();
    untrack(() => {
      const next = passage(id), old = shown;
      shown = next;
      stage.append(next);
      const motion = !first && !reducedMotion();
      if (!first) next.querySelector<HTMLElement>(".hm-bs-title")?.focus({ preventScroll: true });
      first = false;
      if (!old) return;
      if (!motion) { old.remove(); return; }
      const s = (forward ? 1 : -1) * (untrack(dir) === "rtl" ? -1 : 1);
      old.classList.add("is-leaving");
      void animate(old, { opacity: [1, 0], transform: ["perspective(1200px) rotateY(0deg) translateX(0px)", `perspective(1200px) rotateY(${18 * s}deg) translateX(${-60 * s}px)`], filter: ["blur(0px)", "blur(6px)"] }, { duration: 420, easing: "in", fill: "forwards" })
        .finished.then(() => old.remove());
      animate(next, { opacity: [0, 1], transform: [`perspective(1200px) rotateY(${-22 * s}deg) translateX(${70 * s}px)`, "perspective(1200px) rotateY(0deg) translateX(0px)"], filter: ["blur(8px)", "blur(0px)"] }, { duration: 760, delay: 120, easing: "expo" });
      const items = next.querySelectorAll(".hm-bs-choices > li");
      items.forEach((li, i) => animate(li, { opacity: [0, 1], transform: ["translateY(14px)", "translateY(0px)"] }, { duration: 460, delay: 380 + i * 90, easing: "out" }));
    });
  });

  const root = h("section", { class: () => cx("hm-bs", val(props.class)), "aria-label": () => props.label ?? t`Story` }, trail, stage) as HTMLElement;
  // keys 1–9 pick a choice of the current passage (not while typing)
  listen(root, {
    keydown: (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key)) return;
      const btn = shown?.querySelector<HTMLElement>(`.hm-bs-choice[data-key="${e.key}"]`);
      if (btn) { e.preventDefault(); btn.click(); }
    },
  });
  return root;
}
