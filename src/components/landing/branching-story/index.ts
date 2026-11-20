// BranchingStory (march/landing): a choose-your-own-path story. Each passage ends in choices; the reader's path
// collects as a trail at the top (any step rewinds to it) and the endings found so far are counted. A pick lights the
// chosen button, fades the others and turns the page: the new passage swings in from the reading direction (back:
// from the other side), mirrored in RTL. Keys 1–9 pick a choice. Focus moves to the new passage's heading. The stage
// keeps a minimum height so the page does not jump between passages.
import "./branching-story.css";
import { h } from "../../../dom/h.ts";
import { signal, computed, effect, untrack, createRoot, getOwner } from "../../../core/reactive.ts";
import { t, dir, messages } from "../../../core/i18n.ts";
import { cx, val, setStyle, listen, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { still, swapTransition } from "../../../motion/engine/parts.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { Breadcrumbs, type Crumb } from "../../navigation/breadcrumbs/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import tr from "./tr.ts";
import type { Handler } from "../../../core/util.ts";

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
  /** Passages by id. @tr Kimliğe göre pasajlar. */
  passages: Record<string, StoryPassage>;
  /** Id of the first passage. @tr İlk pasajın kimliği. */
  start: string;
  /** The path (passage ids from the start), to restore or drive it from outside. @tr Yol (baştan itibaren pasaj kimlikleri); dışarıdan geri yüklemek ya da yönetmek için. */
  path?: MaybeFn<string[]> | undefined;
  /** Called with the new path after every choice or rewind. @tr Her seçimden ya da geri sarmadan sonra yeni yolla çağrılır. */
  onChange?: Handler<[path: string[]]> | undefined;
  /** Show the trail of choices (default true). @tr Seçimlerin izini gösterir (varsayılan true). */
  trail?: boolean | undefined;
  /** Count the endings found (default true). @tr Bulunan sonları sayar (varsayılan true). */
  endings?: boolean | undefined;
  /** Shown at an ending, next to "Start again" (a call to action). @tr Bir sonda, "Start again" düğmesinin yanında gösterilir (bir eylem çağrısı). */
  action?: unknown | undefined;
  /** Minimum stage height (CSS length, default "20rem"): passages of different length do not move the page. @tr En küçük sahne yüksekliği (CSS uzunluğu, varsayılan "20rem"): farklı uzunluktaki pasajlar sayfayı oynatmaz. */
  minHeight?: string | undefined;
  /** Accessible name (default "Story"). @tr Erişilebilir ad (varsayılan "Story"). */
  label?: string | undefined;
  /** Every text the story writes itself; the defaults are translated. `endings` gets the found and the total count. @tr Hikâyenin kendi yazdığı her metin; varsayılanlar çevrilmiştir. `endings` bulunan ve toplam sayıyı alır. */
  labels?: {
    /** Accessible name of the trail (default "Your path"). */
    path?: string;
    /** First step of the trail (default "Start"). */
    start?: unknown;
    endings?: (found: number, total: number) => unknown;
    /** Body of a passage id that does not exist. */
    missing?: unknown;
    /** Heading of an ending without a title or a name (default "The end"). */
    end?: unknown;
    /** Before the ending's name in its badge (default "Ending: "). */
    endingPrefix?: unknown;
    /** The button at an ending (default "Start again"). */
    restart?: unknown;
  } | undefined;
  /** The "Start again" button at an ending (default true). @tr Bir sondaki "Start again" düğmesi (varsayılan true). */
  restart?: boolean | undefined;
  /** Number keys 1–9 pick a choice, and each choice shows its number (default true). @tr 1–9 sayı tuşları bir seçeneği seçer ve her seçenek kendi numarasını gösterir (varsayılan true). */
  keys?: boolean | undefined;
  /** Draw the content of a choice button yourself (the button, its key and its motion stay). @tr Bir seçenek düğmesinin içeriğini kendiniz çizin (düğme, tuşu ve hareketi kalır). */
  renderChoice?: Handler<[choice: StoryChoice, index: number]> | undefined;
  /**
   * How the page changes: "turn" (default: a 3D page turn), "slide", "fade", "none", or your own keyframes for the
   * leaving and the entering passage; `side` is 1 forward and -1 back (already mirrored in RTL).
   * @tr Sayfanın nasıl değiştiği: "turn" (varsayılan: 3B sayfa çevirme), "slide", "fade", "none" ya da çıkan ve giren pasaj için kendi keyframe'leriniz; `side` ileri için 1, geri için -1'dir (RTL'de zaten aynalanmış).
   */
  transition?: "turn" | "slide" | "fade" | "none"
    | ((side: 1 | -1) => { leave: Record<string, unknown[]>; enter: Record<string, unknown[]>; duration?: number; easing?: string }) | undefined;
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

type Turn = { leave: Record<string, unknown[]>; enter: Record<string, unknown[]>; duration?: number; easing?: string };
// how long the arriving passage takes per ready-made kind (the frames are the shared swap frames)
const ENTER: Record<"turn" | "slide" | "fade", { duration: number; easing: string }> = { turn: { duration: 760, easing: "expo" }, slide: { duration: 520, easing: "expo" }, fade: { duration: 420, easing: "out" } };

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
  // no passages yet (a raw component): the start passage reads as missing, not an error
  const passages = props.passages ?? {}, start = props.start ?? "";
  const path = signal<string[]>(untrack(() => val(props.path)) ?? [start]);
  const all = storyEndings(passages, start);
  const found = signal<ReadonlySet<string>>(new Set());
  // an ending counts as found however it was reached (a choice, a rewind, or a path given from outside)
  const see = (p: string[]): void => {
    const id = p[p.length - 1];
    if (id != null && passages[id] && !passages[id]!.choices?.length && !found.peek().has(id)) found.set(new Set([...found.peek(), id]));
  };
  if (props.path !== undefined) effect(() => { const p = val(props.path); if (p?.length) { path.set(p); untrack(() => see(p)); } });
  const current = computed(() => { const p = path(); return p[p.length - 1] ?? start; });
  let forward = true;
  const go = (next: string[]): void => {
    forward = next.length >= path.peek().length;
    path.set(next);
    see(next);
    props.onChange?.(next);
  };

  // the trail: one step per choice made, labelled with the choice; a step rewinds the story to it
  const L = props.labels ?? {};
  // (Breadcrumbs in a pill look: the current step filled, an earlier one a button; a long path folds into its "…" menu)
  const trail = props.trail === false ? null : h("div", { class: "m-bs-top" },
    h(Breadcrumbs, {
      class: "m-bs-trail", label: () => L.path ?? t`Your path`,
      items: () => path().map((id, i, p): Crumb => {
        const prev = i ? passages[p[i - 1]!] : null;
        const via = prev?.choices?.find((c) => c.to === id)?.label ?? L.start ?? t`Start`;
        return { id: `${i}:${id}`, label: via as string, onSelect: () => go(p.slice(0, i + 1)) };
      }),
    }),
    props.endings === false || !all.length ? null : h("span", { class: "m-bs-found" }, () => (L.endings ? L.endings(found().size, all.length) : t`Endings found: ${found().size} / ${all.length}`)));

  const stage = h("div", { class: "m-bs-stage" }) as HTMLElement;
  setStyle(stage, { "--m-bs-min": props.minHeight ?? "20rem" });

  const pick = (btn: HTMLElement, to: string): void => {
    const done = (): void => go([...path.peek(), to]);
    if (still(props.transition)) { done(); return; }
    btn.classList.add("is-picked");
    btn.closest(".m-bs-choices")?.classList.add("is-deciding");
    void animate(btn, { transform: ["scale(1)", "scale(1.04)", "scale(1)"] }, { duration: 320, easing: "out" }).finished.then(done);
  };

  // each passage has its own scope under the story (not under the effect that draws it): it stays whole while it
  // leaves and is disposed when it is removed
  const owner = getOwner();
  const scopes = new WeakMap<HTMLElement, () => void>();
  const drop = (el: HTMLElement): void => { el.remove(); scopes.get(el)?.(); };
  const passage = (id: string): HTMLElement => createRoot((dispose) => {
    const p = passages[id] ?? { body: L.missing ?? t`This part of the story is missing.` };
    const choices = p.choices ?? [];
    const heading = h("h3", { class: "m-bs-title", tabindex: "-1" }, p.title ?? (choices.length ? "" : p.ending ?? L.end ?? t`The end`));
    const el = h("article", { class: cx("m-bs-passage", !choices.length && "is-ending"), "data-m-color": colorAttr(p.color) },
      p.media != null ? h("div", { class: "m-bs-media" }, p.media) : null,
      h("div", { class: "m-bs-copy" },
        !choices.length && p.ending != null && p.title != null ? h(Badge, { tone: "primary", class: "m-bs-ending" }, L.endingPrefix ?? t`Ending: `, p.ending) : null,
        heading,
        h("div", { class: "m-bs-body" }, p.body),
        choices.length
          // a choice is a button around a ListRow: its number key, the label and a small note
          ? h("ol", { class: "m-bs-choices" }, ...choices.map((c, i) => h("li", null, h("button", {
            type: "button", class: "m-bs-choice", "data-key": String(i + 1),
            onClick: (e: MouseEvent) => pick(e.currentTarget as HTMLElement, c.to),
          }, h(ListRow, {
            as: "span", overflow: "wrap",
            lead: props.keys === false ? undefined : h("span", { "aria-hidden": "true" }, h(Kbd, { class: "m-bs-key" }, String(i + 1))),
            title: props.renderChoice ? h("span", { class: "m-bs-choice-own" }, props.renderChoice(c, i)) : c.label,
            sub: props.renderChoice ? undefined : c.note ?? undefined,
          })))))
          : props.restart === false && props.action == null ? null : h("div", { class: "m-bs-end" },
            props.restart === false ? null : h(Button, { class: "m-bs-restart", onClick: () => go([start]) }, () => L.restart ?? t`Start again`),
            props.action ?? null))) as HTMLElement;
    scopes.set(el, dispose);
    return el;
  }, owner);

  // page turn: the old passage leaves to one side, the new swings in from the other (reading direction, mirrored back)
  let shown: HTMLElement | null = null, first = true;
  effect(() => {
    const id = current();
    untrack(() => {
      const next = passage(id), old = shown;
      shown = next;
      stage.append(next);
      const kind = props.transition ?? "turn";
      if (!first) next.querySelector<HTMLElement>(".m-bs-title")?.focus({ preventScroll: true });
      const moves = !first && !still(kind);
      first = false;
      if (!old) return;
      if (!moves) { drop(old); return; }
      // the shared swap: a ready kind (mirrored in RTL), or your own keyframes for the side the page turns to
      const side = forward ? 1 : -1, rtl = untrack(dir) === "rtl";
      const own: Turn | null = typeof kind === "function" ? kind((rtl ? -side : side) as 1 | -1) : null;
      const how = own ?? ENTER[kind as "turn"] ?? ENTER.turn;
      void swapTransition(next, old, own ? { enter: own.enter, leave: own.leave } : kind as "turn" | "none", { dir: side, rtl, delay: 120, duration: how.duration ?? 760, easing: (how.easing ?? "expo") as "expo", leaveDuration: 420, leaveEasing: "in" })
        .then(() => drop(old));
      const items = next.querySelectorAll(".m-bs-choices > li");
      items.forEach((li, i) => animate(li, { opacity: [0, 1], transform: ["translateY(14px)", "translateY(0px)"] }, { duration: 460, delay: 380 + i * 90, easing: "out" }));
    });
  });

  const root = h("section", { class: () => cx("m-bs", val(props.class)), "aria-label": () => props.label ?? t`Story` }, trail, stage) as HTMLElement;
  // keys 1–9 pick a choice of the current passage (not while typing)
  if (props.keys !== false) listen(root, {
    keydown: (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key)) return;
      const btn = shown?.querySelector<HTMLElement>(`.m-bs-choice[data-key="${e.key}"]`);
      if (btn) { e.preventDefault(); btn.click(); }
    },
  });
  return root;
}
