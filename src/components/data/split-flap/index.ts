// SplitFlap (march/data): a split-flap board, the clattering departure board of a station or an airport. Each cell is
// a reel of flaps (letters, digits, signs); on a new value every cell flips forward, one flap at a time, until it
// reaches its character, with a little stagger between cells. The flaps turn on the motion engine's clock (global
// speed, pause, off-screen and reduced motion apply); a new value mid-way keeps each reel turning from the flap it
// shows, as a real board does. Screen readers get the text once, never the flaps.
// Odometer's "flip" look carries numbers only (CountRoll rolls digits); a board of letters needs reels, so this is its
// own minimal component. FlipClock is Odometer; a timetable is a column of SplitFlaps.
//   <SplitFlap value="İSTANBUL" length={10} />   <SplitFlap value={$gate} length={3} align="end" color="warning" />
import "./split-flap.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { still } from "../../../motion/engine/parts.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** The reel of a cell when none is given: a space, the Turkish alphabet, Q W X, digits and signs. @tr Verilmediğinde bir hücrenin makarası: boşluk, Türk alfabesi, Q W X, rakamlar ve işaretler. */
export const FLAP_REEL = " ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZQWX0123456789.,:-/'!?&+#@";

export interface SplitFlapProps {
  /** The text shown (it may be live); a number is written as it is. @tr Gösterilen metin (canlı olabilir); bir sayı olduğu gibi yazılır. */
  value: MaybeFn<string | number | null | undefined>;
  /** Number of cells; longer text is cut, shorter text padded. Default: as many as the text. @tr Hücre sayısı; uzun metin kesilir, kısa metin doldurulur. Varsayılan: metin kadar. */
  length?: MaybeFn<number | undefined>;
  /** Where shorter text sits: "start" (default), "center" or "end". @tr Kısa metnin yeri: "start" (varsayılan), "center" ya da "end". */
  align?: MaybeFn<"start" | "center" | "end" | undefined>;
  /** The flaps of every reel, in the order they turn (the first one is the blank). Text is upper-cased in the page's language when the reel has no lower case. Default FLAP_REEL. @tr Her makaranın kanatları, döndükleri sırayla (ilki boştur). Makarada küçük harf yoksa metin sayfanın dilinde büyük harfe çevrilir. Varsayılan FLAP_REEL. */
  chars?: MaybeFn<string | undefined>;
  /** Time of one flap (ms). Default 70. @tr Bir kanadın süresi (ms). Varsayılan 70. */
  flapTime?: MaybeFn<number | undefined>;
  /** Delay between neighbouring cells as they start (ms). Default 45. @tr Komşu hücrelerin başlaması arasındaki gecikme (ms). Varsayılan 45. */
  stagger?: MaybeFn<number | undefined>;
  /** Size: "sm", "md" (default), "lg", or the cell height in px. @tr Boyut: "sm", "md" (varsayılan), "lg" ya da px cinsinden hücre yüksekliği. */
  size?: MaybeFn<"sm" | "md" | "lg" | number | undefined>;
  /** Theme color token of the characters. Default: the board's white ink. @tr Karakterlerin tema renk belirteci. Varsayılan: tablonun beyaz mürekkebi. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Accessible name before the text. Default "Board". @tr Metinden önceki erişilebilir ad. Varsayılan "Board". */
  label?: MaybeFn<string | undefined>;
  /** Announce a new text once it has settled: "polite" or "off" (default). @tr Yeni metni yerine oturunca duyur: "polite" ya da "off" (varsayılan). */
  live?: MaybeFn<"polite" | "off" | undefined>;
  /** Motion: false (or "none") shows a new text at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") yeni metni hemen gösterir; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** The board frame around the cells; false: the bare cells. Default true. @tr Hücrelerin çevresindeki tablo çerçevesi; false: çıplak hücreler. Varsayılan true. */
  frame?: MaybeFn<boolean | undefined>;
  /** Called when every cell has reached its character. @tr Her hücre karakterine ulaştığında çağrılır. */
  onSettle?: ((text: string) => void) | undefined;
  /** Extra class on the root (`m-flap`). @tr Köke (`m-flap`) eklenen sınıf. */
  class?: ClassProp;
}

interface Cell {
  /** flap shown (reel index), the one to stop at, how far the current flap has turned (0–1), ms still to wait */
  at: number; goal: number; turn: number; wait: number;
  /** a character not on the reel: shown as it is, no flaps */
  odd: string | null;
  el: HTMLElement; top: Text; bottom: Text; front: Text; back: Text; drawn: number;
}

/** `<SplitFlap value="İSTANBUL" length={10} />` */
export function SplitFlap(props: SplitFlapProps): Element {
  const reel = computed(() => { const r = val(props.chars); return r && r.length > 1 ? [...r] : [...FLAP_REEL]; });
  const upper = computed(() => !reel().some((c) => c !== c.toLocaleUpperCase()));
  // the text on the board: upper-cased for a capitals-only reel, cut or padded to `length`, aligned
  const text = computed((): string => {
    const v = val(props.value);
    const raw = v == null ? "" : String(v);
    return upper() ? raw.toLocaleUpperCase(locale()) : raw;
  });
  const cells = computed((): string[] => {
    const chars = [...text()], n = Math.max(1, Math.round(val(props.length) ?? chars.length) || 1);
    if (chars.length >= n) return chars.slice(0, n);
    const free = n - chars.length, a = val(props.align) ?? "start", left = a === "center" ? Math.floor(free / 2) : a === "end" ? free : 0;
    const blank = reel()[0]!;
    return [...Array<string>(left).fill(blank), ...chars, ...Array<string>(free - left).fill(blank)];
  });
  const shownText = computed(() => cells().join("").trim());
  const settled = signal(true);

  let list: Cell[] = [];
  const glyph = (cl: string, tx: Text): Element => h("span", { class: cl }, h("span", { class: "m-flap-glyph" }, tx));
  const make = (): Cell => {
    const top = document.createTextNode(""), bottom = document.createTextNode(""), front = document.createTextNode(""), back = document.createTextNode("");
    const el = h("span", { class: "m-flap-cell is-idle" },
      glyph("m-flap-half is-top", top), glyph("m-flap-half is-bottom", bottom),
      h("span", { class: "m-flap-leaf" }, glyph("m-flap-face is-front", front), glyph("m-flap-face is-back", back))) as HTMLElement;
    return { at: 0, goal: 0, turn: 0, wait: 0, odd: null, el, top, bottom, front, back, drawn: -2 };
  };
  // write a cell: the flap it shows and, while turning, the next one on the leaf
  const draw = (c: Cell): void => {
    const r = reel(), n = r.length;
    if (c.odd != null) { c.top.data = c.bottom.data = c.front.data = c.back.data = c.odd; c.el.classList.add("is-idle"); c.drawn = -1; return; }
    const moving = c.at !== c.goal || c.turn > 0;
    if (c.drawn !== c.at) {
      const cur = r[c.at] ?? "", next = r[(c.at + 1) % n] ?? "";
      c.bottom.data = cur; c.front.data = cur;
      c.top.data = moving ? next : cur; c.back.data = next;
      c.drawn = c.at;
    }
    if (moving) c.top.data = r[(c.at + 1) % n] ?? "";
    c.el.classList.toggle("is-idle", !moving);
    c.el.style.setProperty("--m-flap-turn", `${Math.round(-180 * c.turn)}deg`);
  };

  // ANIMATE: one loop on the engine's clock turns every moving reel forward
  let stop: (() => void) | null = null;
  const halt = (): void => { stop?.(); stop = null; };
  onCleanup(halt);
  const tick = (_t: number, dt: number): void => {
    const per = Math.max(10, val(props.flapTime) ?? 70), n = reel().length;
    let busy = false;
    for (const c of list) {
      if (c.odd != null || (c.at === c.goal && c.turn === 0)) continue;
      busy = true;
      if (c.wait > 0) { c.wait -= dt; continue; }
      c.turn += dt / per;
      while (c.turn >= 1) { c.at = (c.at + 1) % n; c.turn -= 1; if (c.at === c.goal) { c.turn = 0; break; } }
      draw(c);
    }
    if (!busy) { halt(); settled.set(true); untrack(() => props.onSettle?.(shownText())); }
  };

  // the same cells while the count stays; a new count keeps what each kept cell shows
  const ensure = (n: number): void => { while (list.length < n) list.push(make()); list.length = n; };
  const board = h("span", { class: "m-flap-cells", "aria-hidden": "true" }, () => {
    const n = cells().length;
    return untrack(() => { ensure(n); return list.map((c) => c.el); });
  });
  effect(() => {
    const want = cells(), r = reel(), jump = still(props.motion);
    const gap = Math.max(0, val(props.stagger) ?? 45);
    untrack(() => {
      let moving = false;
      ensure(want.length);
      want.forEach((ch, i) => {
        const c = list[i];
        if (!c) return;
        const k = r.indexOf(ch);
        if (k < 0) { c.odd = ch; c.at = c.goal = 0; c.turn = 0; draw(c); return; }
        if (c.odd != null) { c.odd = null; c.at = 0; c.drawn = -2; }
        if (c.at >= r.length) c.at = 0;
        const was = c.goal;
        c.goal = k;
        if (jump || c.drawn === -2) { c.at = k; c.turn = 0; draw(c); return; }
        // a cell already turning keeps turning (its stagger has passed); a still one waits its turn
        if (c.at === was && c.turn === 0 && c.at !== k) c.wait = i * gap;
        if (c.at !== k || c.turn > 0) moving = true;
        draw(c);
      });
      if (moving) { settled.set(false); if (!stop) stop = onFrame(tick, { phase: "update" }); }
      else { halt(); settled.set(true); }
    });
  });

  const sizeOf = (): string | number => val(props.size) ?? "md";
  return h("span", {
    class: () => cx("m-flap", typeof sizeOf() === "string" && `m-flap-${sizeOf()}`, val(props.frame) === false && "m-flap-bare", !settled() && "is-moving", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)),
    style: () => ({ "--m-flap-h": typeof sizeOf() === "number" ? `${clamp(sizeOf() as number, 8, 400)}px` : null }),
  },
  board,
  // the text for screen readers: the target at once (or, when live, once the board has settled)
  h("span", { class: "m-sr-only", "aria-live": () => (val(props.live) === "polite" ? "polite" : null) },
    () => `${val(props.label) ?? t`Board`}: `,
    () => (val(props.live) === "polite" && !settled() ? "" : shownText()))) as Element;
}
