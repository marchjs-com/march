// Presentation (march/landing): slides in the browser. `<Presentation>` holds `<Slide>`s; `<Appear>` reveals its
// children one per step (fragments). Navigation: arrow keys, Page Up / Down, Space, Home / End, the mouse wheel, swipes
// and the buttons; `F` goes full screen, `P` opens the speaker window. Slides change with a slide, fade or zoom transition
// on the motion engine (mirrored in RTL). The slide number can live in the URL (`bind:index`). The speaker view shows the
// current slide, the next one, the notes and a timer; windows of the same deck stay in step through a cross-tab channel.
// Printing (or saving as PDF) lays every slide on its own page with all steps shown. Slides keep a 16:9 stage and scale
// their type with the stage (container units), so a deck looks the same on a laptop and a projector.
import "./presentation.css";
import { h } from "../../../dom/h.ts";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, listen, clamp, isRtl, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { formatDuration } from "../../../ui/format.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Toolbar } from "../../layout/stack/index.ts";
import { Pagination } from "../../navigation/pagination/index.ts";
import { Progress } from "../../feedback/progress/index.ts";
import { channel } from "../../../channel/index.ts";
import { chevronLeft } from "../../../icons/glyphs/chevronLeft.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { monitor } from "../../../icons/glyphs/monitor.ts";
import { maximize } from "../../../icons/glyphs/maximize.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { still, swapTransition } from "../../../motion/engine/parts.ts";
import { swipe } from "../../../motion/gestures.ts";

messages("tr", { "Slides": "Slaytlar" });

export interface SlideProps {
  /** Speaker notes (shown in the speaker view). @tr Konuşmacı notları (konuşmacı görünümünde gösterilir). */
  notes?: string | undefined;
  /** title (centred, large) · content (heading + body, default) · split (two columns) · center · image (full-bleed media). @tr title (ortalı, büyük) · content (başlık + gövde, varsayılan) · split (iki sütun) · center · image (kenardan kenara medya). */
  layout?: "title" | "content" | "split" | "center" | "image" | undefined;
  /** plain · inverse · brand (gradient) @tr plain · inverse · brand (renk geçişli) */
  tone?: "plain" | "inverse" | "brand" | undefined;
  /** A decorative layer behind the slide (an Overlay, a VideoBackground…). @tr Slaydın arkasındaki süs katmanı (bir Overlay, bir VideoBackground…). */
  background?: unknown;
  /** Extra CSS class on the slide. @tr Slayda eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
  /** Slide content. @tr Slayt içeriği. */
  children?: unknown;
}
/** One slide: `<Slide layout="title" notes="Welcome everyone">…</Slide>` */
export function Slide(props: SlideProps): Element {
  return h("section", { class: cx("m-slide", `m-slide-${props.layout ?? "content"}`, `m-slide-tone-${props.tone ?? "plain"}`, val(props.class)), "data-notes": props.notes ?? null },
    props.background != null ? h("div", { class: "m-slide-bg" }, props.background) : null,
    h("div", { class: "m-slide-body" }, props.children)) as Element;
}

/** Fragments: every child appears on its own step. `<Appear><li>One</li><li>Two</li></Appear>` (renders a list); `effect="none"` shows a step without movement. */
export function Appear(props: {
  /** Tag of the wrapper: ul (default), ol, div… @tr Sarmalayıcının etiketi: ul (varsayılan), ol, div… */
  as?: string | undefined;
  /** How each step enters: up (default), fade, scale or none. @tr Her adımın nasıl girdiği: up (varsayılan), fade, scale ya da none. */
  effect?: "up" | "fade" | "scale" | "none" | undefined;
  /** Extra CSS class on the wrapper. @tr Sarmalayıcıya eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
  /** The steps; every child appears on its own step. @tr Adımlar; her çocuk öğe kendi adımında görünür. */
  children?: unknown;
}): Element {
  return h(props.as ?? "ul", { class: cx("m-appear", `m-appear-${props.effect ?? "up"}`, val(props.class)) }, props.children) as Element;
}

export interface PresentationProps {
  /** Current slide, 0-based. With `setIndex` it is controlled (`bind:index`, e.g. a URL query parameter). @tr Geçerli slayt, 0'dan başlar. `setIndex` ile birlikte denetimli olur (`bind:index`, örneğin bir URL sorgu parametresi). */
  index?: MaybeFn<number | undefined>;
  /** Called with the new slide index; makes `index` controlled. @tr Yeni slayt sırasıyla çağrılır; `index` değerini denetimli yapar. */
  setIndex?: ((i: number) => void) | undefined;
  /** How slides change: a ready one, "none", or your own `(incoming, outgoing, direction) => void` (direction 1 = forward; RTL already applied). @tr Slaytların nasıl değiştiği: hazır bir geçiş, "none" ya da kendi `(incoming, outgoing, direction) => void` işleviniz (direction 1 = ileri; RTL zaten uygulanmış). */
  transition?: "slide" | "fade" | "zoom" | "none" | ((incoming: HTMLElement, outgoing: HTMLElement | undefined, direction: 1 | -1) => void) | undefined;
  /** Show the speaker view (current, next, notes, timer). @tr Konuşmacı görünümünü gösterir (geçerli, sıradaki, notlar, süre). */
  presenter?: boolean | undefined;
  /** Keep windows of this deck in step (the speaker window and the audience). Default "deck". @tr Bu sunumun pencerelerini (konuşmacı penceresi ve izleyici) eşit adımda tutar. Varsayılan "deck". */
  sync?: string | false | undefined;
  /** URL the speaker button opens in a new window (a page rendering this deck with `presenter`). @tr Konuşmacı düğmesinin yeni pencerede açtığı URL (bu sunumu `presenter` ile gösteren bir sayfa). */
  presenterUrl?: string | undefined;
  /** Accessible name of the deck. @tr Sunumun erişilebilir adı. */
  label?: string | undefined;
  /** The control row under the stage (default true). @tr Sahnenin altındaki denetim satırı (varsayılan true). */
  controls?: boolean | undefined;
  /** The "Slide 3 of 12" counter: true (default), false, or `(index, total) => content` (index is 0-based). @tr "Slayt 3 / 12" sayacı: true (varsayılan), false ya da `(index, total) => content` (index 0'dan başlar). */
  counter?: boolean | ((index: number, total: number) => unknown) | undefined;
  /** The progress line under the stage (default true). @tr Sahnenin altındaki ilerleme çizgisi (varsayılan true). */
  progress?: boolean | undefined;
  /** Colour of the progress line (default: the brand gradient). @tr İlerleme çizgisinin rengi (varsayılan: marka geçişli rengi). */
  progressColor?: ColorToken | undefined;
  /** The full screen button and the `F` key (default true). @tr Tam ekran düğmesi ve `F` tuşu (varsayılan true). */
  fullscreen?: boolean | undefined;
  /** The timer of the speaker view (default true). @tr Konuşmacı görünümündeki süre sayacı (varsayılan true). */
  timer?: boolean | undefined;
  /** Own icons for the buttons (an icon definition or a node). @tr Düğmeler için kendi ikonlarınız (bir ikon tanımı ya da düğüm). */
  icons?: { previous?: unknown; next?: unknown; speaker?: unknown; fullscreen?: unknown } | undefined;
  /** Own texts; every one defaults to the built-in translated text. @tr Kendi metinleriniz; her biri varsayılan olarak yerleşik çevrilmiş metni kullanır. */
  labels?: {
    previous?: string | undefined; next?: string | undefined; speaker?: string | undefined; fullscreen?: string | undefined;
    /** Accessible name of the previous / counter / next group (default "Slides"). */
    pages?: string | undefined;
    /** Text of the counter (index is 0-based). */
    counter?: ((index: number, total: number) => string) | undefined;
    /** aria-roledescription of the deck ("slide deck"). */
    deck?: string | undefined;
    speakerView?: string | undefined; upNext?: string | undefined; end?: string | undefined; notes?: string | undefined; noNotes?: string | undefined; elapsed?: string | undefined;
  } | undefined;
  /** Extra CSS class on the deck. @tr Sunuma eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
  /** The slides (`Slide` elements). @tr Slaytlar (`Slide` öğeleri). */
  children?: unknown;
}

interface Pos { i: number; s: number }

/** `<Presentation bind:index={$slide} transition="slide"><Slide layout="title">…</Slide><Slide>…</Slide></Presentation>` */
export function Presentation(props: PresentationProps): Element {
  const stage = h("div", { class: "m-deck-stage" }, props.children) as HTMLElement;
  const slides = (): HTMLElement[] => ([...stage.children] as HTMLElement[]).filter((c) => c.classList.contains("m-slide"));
  const steps = (el: HTMLElement | undefined): HTMLElement[] => (el ? [...el.querySelectorAll<HTMLElement>(".m-appear")].flatMap((a) => [...a.children] as HTMLElement[]) : []);
  const list = slides();
  const n = list.length;

  const own = signal(clamp(untrack(() => val(props.index)) ?? 0, 0, Math.max(0, n - 1)));
  const index = (): number => clamp((props.setIndex ? val(props.index) : own()) ?? 0, 0, Math.max(0, n - 1));
  const setIndex = (i: number): void => { if (props.setIndex) props.setIndex(i); else own.set(i); };
  const step = signal(0);
  const pos = computed<Pos>(() => ({ i: index(), s: step() }));

  const sync = props.sync === false ? null : channel<Pos>(`m.deck.${props.sync ?? "deck"}`, { crossTab: true });
  let remote = false;
  const go = (p: Pos): void => {
    const i = clamp(p.i, 0, n - 1), s = clamp(p.s, 0, steps(list[i]).length);
    if (i !== index()) setIndex(i);
    step.set(s);
    if (sync && !remote) sync.emit({ i, s });
  };
  const next = (): void => { const p = pos.peek(); if (p.s < steps(list[p.i]).length) go({ i: p.i, s: p.s + 1 }); else if (p.i < n - 1) go({ i: p.i + 1, s: 0 }); };
  const prev = (): void => { const p = pos.peek(); if (p.s > 0) go({ i: p.i, s: p.s - 1 }); else if (p.i > 0) go({ i: p.i - 1, s: steps(list[p.i - 1]).length }); };
  if (sync) sync.on((p, from) => { if (from !== "tab") return; remote = true; go(p); remote = false; });

  const L = props.labels ?? {};
  // the visible slide and its steps; the change animates (direction-aware, mirrored in RTL)
  let shown = -1;
  let root: HTMLElement | null = null;
  effect(() => {
    const { i, s } = pos();
    untrack(() => {
      list.forEach((el, k) => { const on = k === i; el.classList.toggle("is-current", on); el.toggleAttribute("inert", !on); el.setAttribute("aria-hidden", on ? "false" : "true"); });
      steps(list[i]).forEach((el, k) => {
        const vis = k < s;
        if (vis && !el.classList.contains("is-shown") && shown === i && !still()) {
          // the step enters the way its <Appear effect> says
          const fx = el.parentElement?.classList;
          if (!fx?.contains("m-appear-none")) animate(el, fx?.contains("m-appear-fade") ? { opacity: [0, 1] } : fx?.contains("m-appear-scale") ? { opacity: [0, 1], transform: ["scale(.8)", "scale(1)"] } : { opacity: [0, 1], transform: ["translate3d(0, .6em, 0)", "translate3d(0, 0, 0)"] }, { duration: 420, easing: "expo" });
        }
        el.classList.toggle("is-shown", vis);
      });
      if (shown >= 0 && shown !== i) {
        // the shared swap: a ready kind, or the own function (it gets the direction with RTL already applied)
        const tr = props.transition ?? "slide", d = i > shown ? 1 : -1, rtl = isRtl(root);
        void swapTransition(list[i], list[shown], tr, typeof tr === "function" ? { dir: rtl ? -d as 1 | -1 : d } : { dir: d, rtl, distance: "8%" });
      }
      shown = i;
    });
  });

  const fullscreen = (): void => {
    const d = globalThis.document as Document & { fullscreenElement?: Element | null };
    if (d.fullscreenElement) void d.exitFullscreen?.().catch(() => undefined);
    else void root?.requestFullscreen?.().catch(() => undefined);
  };
  const openSpeaker = (): void => { if (props.presenterUrl) globalThis.open?.(props.presenterUrl, "m-deck-speaker", "popup,width=1100,height=720"); };

  const ownCount = typeof props.counter === "function" ? props.counter : null;
  const counter = props.counter === false ? null
    : h("span", { class: "m-deck-count", "aria-live": "polite" }, () => (ownCount ? ownCount(index(), n) : L.counter ? L.counter(index(), n) : t`Slide ${index() + 1} of ${n}`));
  // previous / counter / next: the simple Pagination, stepping through fragments too (cursor mode: hasPrev / hasNext)
  const pager = h(Pagination, {
    variant: "simple", class: "m-deck-pages", label: () => L.pages ?? t`Slides`, page: () => index() + 1, pages: n, info: false,
    status: counter ? () => counter : false,
    hasPrev: () => !(pos().i === 0 && pos().s === 0), hasNext: () => !(pos().i === n - 1 && pos().s >= steps(list[n - 1]).length), onPrev: prev, onNext: next,
    labels: { previous: () => L.previous ?? t`Previous slide`, next: () => L.next ?? t`Next slide` },
    prev: props.icons?.previous ?? chevronLeft, next: props.icons?.next ?? chevronRight,
  });
  const btn = (cls: string, own: unknown, def: unknown, label: () => string, onClick: () => void, disabled?: () => boolean): unknown =>
    h(IconButton, { class: cls, size: "sm", icon: own ?? def, label, onClick, ...(disabled ? { disabled } : {}) });
  const controls = props.controls === false ? null : h(Toolbar, {
    class: "m-deck-controls",
    end: [
      props.presenterUrl && !props.presenter ? btn("m-deck-speaker-btn", props.icons?.speaker, monitor, () => L.speaker ?? t`Open speaker view`, openSpeaker) : null,
      props.fullscreen !== false ? btn("m-deck-full", props.icons?.fullscreen, maximize, () => L.fullscreen ?? t`Full screen`, fullscreen) : null],
  },
  pager);

  // speaker view: the next slide (a clone, inert), notes and a timer
  const started = Date.now();
  const clock = signal(0);
  let speaker: unknown = null;
  if (props.presenter) {
    const timed = props.timer !== false;
    const timer = timed ? setInterval(() => clock.set(Date.now() - started), 1000) as unknown as { unref?: () => void } : null;
    timer?.unref?.(); // never keeps a test process (or a server render) alive
    if (timer) owned(() => clearInterval(timer as never));
    speaker = h("aside", { class: "m-deck-speaker", "aria-label": L.speakerView ?? t`Speaker view` },
      h("div", { class: "m-deck-next" }, h("p", { class: "m-deck-cap" }, L.upNext ?? t`Next`), () => {
        const nx = list[index() + 1];
        if (!nx) return h("p", { class: "m-deck-end" }, L.end ?? t`End of the deck`);
        const c = nx.cloneNode(true) as HTMLElement;
        c.classList.add("is-current", "is-preview"); c.removeAttribute("inert"); c.setAttribute("aria-hidden", "true");
        for (const x of steps(c)) x.classList.add("is-shown");
        return h("div", { class: "m-deck-preview", inert: "" }, c);
      }),
      h("div", { class: "m-deck-notes" }, h("p", { class: "m-deck-cap" }, L.notes ?? t`Notes`), h("p", { class: "m-deck-note" }, () => list[index()]?.getAttribute("data-notes") || (L.noNotes ?? t`No notes for this slide.`))),
      timed ? h("p", { class: "m-deck-timer", role: "timer", "aria-label": L.elapsed ?? t`Elapsed time` }, () => formatDuration(clock(), { pad: true })) : null);
  }

  root = h("div", {
    class: cx("m-deck", props.presenter && "is-presenter", val(props.class)), tabindex: "0", role: "region",
    "aria-roledescription": L.deck ?? t`slide deck`, "aria-label": props.label ?? t`Presentation`,
  }, h("div", { class: "m-deck-main" }, stage, props.progress !== false ? h(Progress, { variant: "line", decorative: true, class: "m-deck-bar", color: props.progressColor, max: 1, value: () => (n > 1 ? index() / (n - 1) : 1) }) : null, controls), speaker) as HTMLElement;
  const deck = root;

  // keyboard (on the deck, and on the page while it is full screen), wheel, swipe
  let wheelAt = 0;
  const key = (e: KeyboardEvent): void => {
    if ((e.target as Element)?.closest?.("input, textarea, select, [contenteditable]")) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " ") { e.preventDefault(); (isRtl(deck) && k === "ArrowRight") ? prev() : next(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") { e.preventDefault(); (isRtl(deck) && k === "ArrowLeft") ? next() : prev(); }
    else if (k === "Home") { e.preventDefault(); go({ i: 0, s: 0 }); }
    else if (k === "End") { e.preventDefault(); go({ i: n - 1, s: steps(list[n - 1]).length }); }
    else if ((k === "f" || k === "F") && props.fullscreen !== false) fullscreen();
    else if ((k === "p" || k === "P") && props.presenterUrl) openSpeaker();
  };
  const offs = [
    listen(deck, {
      keydown: key,
      wheel: (e: WheelEvent) => { if (!deck.matches(":fullscreen") && !props.presenter) return; const now = Date.now(); if (now - wheelAt < 650 || Math.abs(e.deltaY) < 20) return; wheelAt = now; if (e.deltaY > 0) next(); else prev(); },
    }),
    swipe(stage, { onSwipe: (d: string) => { const rtl = isRtl(deck); if (d === "left") rtl ? prev() : next(); else if (d === "right") rtl ? next() : prev(); } }),
  ];
  owned(() => offs.forEach((f) => f()));
  return deck;
}
