// SectionTimeline (march/navigation): a dot per section of a long page, vertical or horizontal. The section being read
// is in full colour, the ones behind it light, the ones ahead without colour; a press on a dot scrolls to its section.
// Near the pointer (or the focused dot) it magnifies like a dock: the dots move apart and swell, their names open beside
// them, larger the nearer they are. With `hash` the section being read writes its #name into the address (no history
// entry per section) and an address naming a section scrolls there. A section not drawn yet (a lazy part) is reached
// through its `placeholder`: brought into view so it loads, then the section. Every name, size and part is yours.
import "./section-timeline.css";
import { signal, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { Portal } from "../../../dom/portal.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, isRtl, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { nextFrame } from "../../../motion/engine/clock.ts";
import { dockLens } from "../../../ui/dock-lens.ts";
import { reducedMotion } from "../../../motion/env.ts";
import tr from "./tr.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", tr);

/** One section of the timeline. */
export interface SectionTimelineItem {
  /** Its name: beside the dot when magnified, and the dot's accessible name. @tr Adı: büyüyünce noktanın yanında, noktanın erişilebilir adı. */
  label: string;
  /** The section: an element, a selector or a getter (null while it is not drawn yet). @tr Bölüm: bir öğe, bir seçici ya da getter (henüz çizilmediyse null). */
  target: Element | string | (() => Element | null | undefined);
  /** Its #name in the address (letters, digits, "-"); without it the dot is a button, not a link. @tr Adresteki #adı (harf, rakam, "-"); verilmezse nokta bağlantı değil düğmedir. */
  slug?: string | undefined;
  /** What stands in for the section until it is drawn (a lazy part's slot): scrolled to, so the section loads. @tr Bölüm çizilene kadar onun yerini tutan öğe (tembel bir parçanın yuvası): oraya kaydırılır, bölüm yüklenir. */
  placeholder?: (() => Element | null | undefined) | undefined;
}

export interface SectionTimelineProps {
  /** The sections, in page order. @tr Bölümler, sayfadaki sırayla. */
  items: MaybeFn<readonly SectionTimelineItem[]>;
  /** "vertical" (default): a column; "horizontal": a row. @tr "vertical" (varsayılan): bir sütun; "horizontal": bir satır. */
  orientation?: MaybeFn<"vertical" | "horizontal" | undefined>;
  /** The way the page (or `root`) scrolls: "y" (default) or "x"; the dots may stand either way. @tr Sayfanın (ya da `root`'un) kaydığı yön: "y" (varsayılan) ya da "x"; noktalar iki yönde de durabilir. */
  axis?: MaybeFn<"y" | "x" | undefined>;
  /** Fixed at the edge of the screen: the end side when vertical, the bottom when horizontal (default false: in place). @tr Ekranın kenarına sabit: dikeyken bitiş yanı, yatayken alt (varsayılan false: yerinde). */
  fixed?: boolean | undefined;
  /** The box that scrolls (default the page). @tr Kayan kutu (varsayılan sayfa). */
  root?: Element | (() => Element | null | undefined) | undefined;
  /** Magnify near the pointer and the focused dot (default true). @tr İmlecin ve odaktaki noktanın yakınında büyüt (varsayılan true). */
  magnify?: MaybeFn<boolean | undefined>;
  /** How far the magnifier reaches, in px (default 130). @tr Büyütecin erimi, px (varsayılan 130). */
  reach?: MaybeFn<number | undefined>;
  /** Room a fully magnified dot takes beyond its step, in px (default 28). @tr Tam büyümüş bir noktanın adımının ötesinde kapladığı yer, px (varsayılan 28). */
  grow?: MaybeFn<number | undefined>;
  /** When the reader first reaches the first section, the magnifier sweeps once from the first dot to the last, so a
   * newcomer sees the names, not only dots; not before (a page's own opening is left alone), not under reduced motion,
   * and the pointer takes over at once (default false). @tr Okuyucu ilk bölüme ilk kez ulaşınca büyüteç bir kez ilk noktadan sonuncuya gezer, ilk gelen yalnız noktaları değil adları da görür; daha önce değil (sayfanın kendi girişi bozulmaz), hareket azaltılınca yok, imleç gelince hemen o devralır (varsayılan false). */
  intro?: boolean | undefined;
  /** Write the section being read into the address as #slug, and go to a section the address names (default false). @tr Okunan bölümü adrese #slug olarak yaz, adresin söylediği bölüme git (varsayılan false). */
  hash?: boolean | undefined;
  /** Room kept above (or before) a section scrolled to, px (default 80: a sticky top bar). @tr Kaydırılan bölümün üstünde (ya da önünde) bırakılan pay, px (varsayılan 80: yapışkan üst çubuk). */
  offset?: MaybeFn<number | undefined>;
  /** The reading line: a section counts as read once its top passes this share of the box (default 0.33). @tr Okuma çizgisi: bölümün üstü kutunun bu oranını geçince okunuyor sayılır (varsayılan 0.33). */
  line?: MaybeFn<number | undefined>;
  /** Scroll smoothly to a pressed section (default true; off with reduced motion). @tr Basılan bölüme yumuşak kaydır (varsayılan true; hareket azaltılınca kapalı). */
  smooth?: MaybeFn<boolean | undefined>;
  /** When the section being read changes, the dots between the old and the new one take their colour one after
   * another, a wave across the distance: its whole length in ms (default 480), or false for all at once. @tr Okunan bölüm değişince eski ile yeni arasındaki noktalar rengini sırayla alır, mesafe boyunca bir dalga: toplam süresi ms (varsayılan 480), ya da hepsi birden için false. */
  wave?: MaybeFn<number | false | undefined>;
  /** Called with the index of the section being read (-1 above the first). @tr Okunan bölümün sırasıyla çağrılır (ilkinin üstünde -1). */
  onChange?: Handler<[index: number]> | undefined;
  /** Own names: the group. @tr Kendi adların: grup. */
  labels?: { group?: string | undefined } | undefined;
  /** Own content of a name: `(item, index) => content`. @tr Bir adın kendi içeriği: `(item, index) => content`. */
  label?: Handler<[item: SectionTimelineItem, index: number]> | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const elOf = (x: SectionTimelineItem["target"] | undefined): Element | null =>
  !x ? null : typeof x === "string" ? globalThis.document?.querySelector(x) ?? null : typeof x === "function" ? x() ?? null : x;

/** `<SectionTimeline items={sections} hash fixed />`, `<SectionTimeline items={steps} orientation="horizontal" root={() => box} />` */
export function SectionTimeline(props: SectionTimelineProps): unknown {
  const items = (): readonly SectionTimelineItem[] => val(props.items) ?? [];
  const vertical = (): boolean => val(props.orientation) !== "horizontal";
  const yAxis = (): boolean => val(props.axis) !== "x";
  const active = signal(-1);
  let jumping = false, alive = true, written = "";
  const doc = globalThis.document, win = globalThis as unknown as Window;
  const scroller = (): Element | null => (typeof props.root === "function" ? props.root() ?? null : props.root ?? null);
  /** The box's edges on screen, in the timeline's axis. */
  const box = (): { start: number; size: number } => {
    const r = scroller()?.getBoundingClientRect();
    const v = untrack(yAxis);
    return r ? { start: v ? r.top : r.left, size: v ? r.height : r.width } : { start: 0, size: v ? win.innerHeight : win.innerWidth };
  };
  const edge = (el: Element): number => { const r = el.getBoundingClientRect(); return untrack(yAxis) ? r.top : r.left; };
  /** Where an item stands now: its section, or while it is not drawn its placeholder (for the first item that shares it). */
  const placeOf = (it: SectionTimelineItem, i: number, list: readonly SectionTimelineItem[]): Element | null =>
    elOf(it.target) ?? (it.placeholder && (i === 0 || list[i - 1]?.placeholder?.() !== it.placeholder()) ? it.placeholder() ?? null : null);

  const measure = (): number => {
    const b = box(), at = b.start + b.size * (val(props.line) ?? 0.33), list = untrack(items);
    let found = -1;
    list.forEach((it, i) => { const el = placeOf(it, i, list); if (el && edge(el) <= at) found = i; });
    return found;
  };
  const address = (i: number): void => {
    if (!props.hash || !globalThis.history || !globalThis.location) return;
    const slug = untrack(items)[i]?.slug, want = i >= 0 && slug ? `#${slug}` : "";
    if (want === written) return;
    written = want;
    const l = globalThis.location;
    globalThis.history.replaceState(globalThis.history.state, "", `${l.pathname}${l.search}${want}`);
  };
  /** The colour wave: each dot between the old and the new section waits by its distance from the old one. */
  const wave = (from: number, to: number): void => {
    const total = val(props.wave), els = list?.children;
    if (!els) return;
    const span = Math.abs(to - from), per = total === false || reducedMotion() || span < 2 ? 0 : Math.min(60, (total ?? 480) / span);
    for (let i = 0; i < els.length; i++) {
      const d = per && (to > from ? i > from && i <= to : i < from && i >= to) ? Math.round(Math.abs(i - from) * per) : 0;
      (els[i] as HTMLElement).style.setProperty("--m-stl-delay", d ? `${d}ms` : "");
    }
  };
  let introDue = !!props.intro;
  const set = (i: number): void => {
    const was = active.peek();
    if (i === was) return;
    // the intro waits for the first section to be reached (and the timeline to be on screen: a hidden one has no size)
    if (introDue && i >= 0 && list?.getClientRects().length) { introDue = false; void wait(250).then(() => { if (alive) intro(); }); }
    wave(Math.max(was, -1), i);
    active.set(i); address(i); props.onChange?.(i);
  };
  let queued = false;
  const spy = (): void => {
    if (queued || !alive) return;
    queued = true;
    nextFrame(() => { queued = false; if (alive && !jumping) set(measure()); });
  };
  const target = (): EventTarget | null => scroller() ?? win;
  let listening: EventTarget | null = null;
  const listen = (): void => {
    const to = target();
    if (to === listening) return;
    listening?.removeEventListener("scroll", spy);
    to?.addEventListener("scroll", spy, { passive: true });
    listening = to;
  };
  win.addEventListener?.("resize", spy, { passive: true });

  /** Scroll the box so `el` stands `offset` from its start. */
  const scrollTo = (el: Element, behavior: ScrollBehavior): void => {
    const s = scroller(), d = edge(el) - box().start - (val(props.offset) ?? 80), v = untrack(yAxis);
    const by = v ? { top: d, behavior } : { left: d, behavior };
    if (s) s.scrollBy?.(by); else win.scrollBy?.(by);
  };
  /** Go to a section; one not drawn yet is reached through its placeholder (it loads as it comes into view). */
  const jump = async (i: number, smooth = true): Promise<void> => {
    const it = untrack(items)[i];
    if (!it) return;
    jumping = true;
    set(i);
    try {
      for (let k = 0; k < 80 && alive && !elOf(it.target); k++) {
        const ph = it.placeholder?.();
        if (!ph) return;
        scrollTo(ph, "instant");
        await wait(150);
      }
      const behavior: ScrollBehavior = smooth && val(props.smooth) !== false && !reducedMotion() ? "smooth" : "instant";
      // parts before it may still arrive and push it on: scroll again until it stays where it should be
      for (let k = 0; k < 4 && alive; k++) {
        const el = elOf(it.target);
        if (!el) return;
        const off = edge(el) - box().start - (val(props.offset) ?? 80);
        if (Math.abs(off) < 6) break;
        scrollTo(el, k ? "instant" : behavior);
        await wait(k ? 250 : 700);
      }
    } finally {
      jumping = false;
      spy();
    }
  };

  // ── the magnifier (march/ui dock-lens): the dots move apart and swell near the pointer or the focused dot
  let list: HTMLElement | undefined;
  const lens = dockLens({ list: () => list, vertical, reach: () => val(props.reach), grow: () => val(props.grow), shiftVar: "--m-stl-shift" });
  const intro = (): void => { if (props.intro && on()) lens.sweep(); };
  const on = (): boolean => val(props.magnify) !== false;

  const markOf = (i: number): HTMLElement | null => (list?.children[i]?.firstElementChild as HTMLElement | null) ?? null;
  const onKeyDown = (e: KeyboardEvent): void => {
    const n = untrack(items).length, v = untrack(vertical), rtl = !v && isRtl(e.currentTarget as Element);
    const cur = list ? [...list.children].findIndex((li) => li.contains(doc?.activeElement ?? null)) : -1;
    const fwd = v ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight", back = v ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
    const to = e.key === fwd ? cur + 1 : e.key === back ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (to == null || to < 0 || to >= n) return;
    e.preventDefault();
    markOf(to)?.focus();
  };

  // an address that names a section (a shared link): go there once the page is drawn
  if (props.hash && globalThis.location?.hash) {
    const first = untrack(items).findIndex((it) => it.slug && `#${it.slug}` === globalThis.location.hash);
    written = globalThis.location.hash;
    if (first >= 0) void wait(300).then(() => jump(first, false));
  }
  queueMicrotask(() => { if (alive) { listen(); spy(); } });

  onCleanup(() => {
    alive = false;
    lens.dispose();
    listening?.removeEventListener("scroll", spy);
    win.removeEventListener?.("resize", spy);
  });

  const view = h("nav", {
    class: () => cx("m-stl", vertical() ? "m-stl-vertical" : "m-stl-horizontal", props.fixed && "is-fixed", val(props.class)),
    "aria-label": () => props.labels?.group ?? t`Sections`,
  }, h("div", { class: "m-stl-rail" }, h("ol", {
    class: "m-stl-list", ref: (el: HTMLElement) => { list = el; },
    onPointerEnter: () => { if (on()) lens.enter(); },
    onPointerMove: (e: PointerEvent) => { if (!on()) return; lens.enter(); lens.at(untrack(vertical) ? e.clientY : e.clientX); },
    onPointerLeave: () => lens.at(null),
    onFocusin: (e: FocusEvent) => {
      const li = (e.target as Element).closest("li");
      if (li && list && on()) lens.atItem([...list.children].indexOf(li));
    },
    onFocusout: () => lens.at(null),
    onKeyDown,
  }, () => {
    const list = items();
    return untrack(() => list.map((it, i) => {
      const cur = (): boolean => active() === i;
      const tag = it.slug ? "a" : "button";
      return h("li", { class: () => cx("m-stl-item", cur() && "is-on", i < active() && "is-past") },
        h(tag, {
          class: "m-stl-mark", ...(it.slug ? { href: `#${it.slug}` } : { type: "button" }),
          "aria-label": it.label, "aria-current": () => (cur() ? "location" : null),
          // one tab stop: the section being read (the first before any); the arrow keys move between the rest
          tabindex: () => (cur() || (active() < 0 && i === 0) ? "0" : "-1"),
          onClick: (e: MouseEvent) => { e.preventDefault(); void jump(i); },
        },
        h("svg", { class: "m-stl-dot", viewBox: "0 0 24 24", "aria-hidden": "true" },
          h("circle", { class: "m-stl-halo", cx: "12", cy: "12", r: "11.5" }), h("circle", { cx: "12", cy: "12", r: "11.5" })),
        h("span", { class: "m-stl-label", "aria-hidden": "true" }, props.label ? props.label(it, i) : it.label)));
    }));
  })));
  return props.fixed ? h(Portal, { mount: doc?.body, children: view }) : view;
}
