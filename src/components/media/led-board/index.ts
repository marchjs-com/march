// LedBoard (march/ui): a fun LED sign. Text scrolls in any direction (typewriter, blink, wave and rainbow effects,
// `:heart:` pixel emoji inline), and a list of scenes plays one after another: text, emoji, LED eyes with a mouth, pixel
// art, a clock, a countdown, a score whose digits roll when it changes, a ticker, audio bars. Scenes change with a
// wipe, a dissolve, pixel rain or an iris. Composed of LedMatrix (the screen), PixelFont, PixelSprite and LedEyes.
// Everything runs on the motion engine's clock: global speed and pause act on it, it sleeps off screen, reduced motion
// pages the text instead of scrolling it; Space pauses, the arrow keys step through the scenes; screen readers hear
// each scene's text.
import "./led-board.css";
import { signal, computed, effect, onCleanup, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, isRtl, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { watchVisibility } from "../../../motion/engine/visibility.ts";
import { still } from "../../../motion/engine/parts.ts";
import { liveSource } from "../../../audio/live.ts";
import type { AudioSourceLike } from "../../../audio/index.ts";
import { ledFrame, clearFrame, ledColor, type LedFrame } from "../led-matrix/frame.ts";
import { screenProps, type LedLookProps } from "../led-matrix/screen.ts";
import { LedMatrix } from "../led-matrix/index.ts";
import { faceMotion } from "../led-eyes/face.ts";
import type { PixelFontName } from "../pixel-font/font.ts";
import { contentOf, mixFrames, type LedScene, type LedDirection, type LedEffect, type LedTransition, type Content, type SceneEnv } from "./scenes.ts";

export type { LedScene, LedDirection, LedEffect, LedTransition } from "./scenes.ts";

export interface LedBoardProps extends LedLookProps {
  /** Text to show (`:heart:` puts an emoji in it); the same as `scenes={[{ text }]}`. @tr Gösterilecek metin (`:heart:` içine emoji koyar); `scenes={[{ text }]}` ile aynı. */
  text?: MaybeFn<string | undefined>;
  /** Scenes played one after another: `[{ text: "HADİ" }, { eye: "look-left" }, { emoji: "heart" }, { clock: true }]`. @tr Art arda oynayan sahneler: `[{ text: "HADİ" }, { eye: "look-left" }, { emoji: "heart" }, { clock: true }]`. */
  scenes?: MaybeFn<readonly LedScene[] | undefined>;
  /** LEDs across. Default 64. @tr Yatayda LED sayısı. Varsayılan 64. */
  cols?: MaybeFn<number | undefined>;
  /** LEDs down. Default 16. @tr Dikeyde LED sayısı. Varsayılan 16. */
  rows?: MaybeFn<number | undefined>;
  /** Where text moves: "left" (default), "right", "up", "down". @tr Metnin hareket yönü: "left" (varsayılan), "right", "up", "down". */
  direction?: MaybeFn<LedDirection | undefined>;
  /** Scroll speed in LEDs per second. Default 30. @tr LED/saniye cinsinden kayma hızı. Varsayılan 30. */
  speed?: MaybeFn<number | undefined>;
  /** How long text that fits stays, in ms (half of a scene's minimum). Default 1400. @tr Sığan metnin kalma süresi, ms (bir sahnenin en kısasının yarısı). Varsayılan 1400. */
  pause?: MaybeFn<number | undefined>;
  /** Text effect: "none" (default), "typewriter", "blink", "wave", "rainbow". @tr Metin efekti: "none" (varsayılan), "typewriter", "blink", "wave", "rainbow". */
  effect?: MaybeFn<LedEffect | undefined>;
  /** "5x7" (default) or "8x8" (bolder). @tr "5x7" (varsayılan) ya da "8x8" (daha kalın). */
  font?: MaybeFn<PixelFontName | undefined>;
  /** LEDs between letters. Default 1. @tr Harfler arası LED sayısı. Varsayılan 1. */
  spacing?: MaybeFn<number | undefined>;
  /** Text and art size: 1, 2, 3 or "auto" (default: as big as the rows allow, 2 on 16 rows). @tr Metin ve çizim boyutu: 1, 2, 3 ya da "auto" (varsayılan: satırların izin verdiği kadar, 16 satırda 2). */
  scale?: MaybeFn<number | "auto" | undefined>;
  /** Color of the text ("#ff8a00"); default the screen's color. @tr Metnin rengi ("#ff8a00"); varsayılan ekranın rengi. */
  ink?: MaybeFn<string | undefined>;
  /** How scenes change: "wipe" (default), "cut", "dissolve", "rain", "iris". @tr Sahnelerin değişimi: "wipe" (varsayılan), "cut", "dissolve", "rain", "iris". */
  transition?: MaybeFn<LedTransition | undefined>;
  /** Transition length in ms. Default 650. @tr Geçiş süresi, ms. Varsayılan 650. */
  transitionDuration?: MaybeFn<number | undefined>;
  /** Start again after the last scene (default true); false stays on it. @tr Son sahneden sonra baştan başlar (varsayılan true); false sonda kalır. */
  loop?: MaybeFn<boolean | undefined>;
  /** Play (default true); false holds the current picture. @tr Oynatır (varsayılan true); false o anki resimde durur. */
  playing?: MaybeFn<boolean | undefined>;
  /** Hold while the pointer is over the board. @tr İşaretçi panonun üstündeyken durur. */
  pauseOnHover?: MaybeFn<boolean | undefined>;
  /** Eyes of eye scenes blink and glance on their own (default true). @tr Göz sahnelerindeki gözler kendiliğinden kırpar ve bakınır (varsayılan true). */
  alive?: MaybeFn<boolean | undefined>;
  /** Eyes of eye scenes follow the pointer. @tr Göz sahnelerindeki gözler işaretçiyi izler. */
  follow?: MaybeFn<boolean | undefined>;
  /** Accessible name of the board (default "LED board"). @tr Panonun erişilebilir adı (varsayılan "LED pano"). */
  label?: MaybeFn<string | undefined>;
  /** Screen readers hear each scene's text: "polite" (default) or "off". @tr Ekran okuyucular her sahnenin metnini duyar: "polite" (varsayılan) ya da "off". */
  live?: MaybeFn<"polite" | "off" | undefined>;
  /** false or "none": pages instead of scrolling, no effects or transitions (as with reduced motion). @tr false ya da "none": kaydırma yerine sayfalar, efekt ve geçiş yok (azaltılmış harekette olduğu gibi). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Called when a scene starts: its index and the scene. @tr Bir sahne başladığında çağrılır: sırası ve sahne. */
  onScene?: ((index: number, scene: LedScene) => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<LedBoard text="HADİ'ye hoş geldin :heart:" color="amber" />` */
export function LedBoard(props: LedBoardProps): Element {
  const cols = (): number => Math.max(4, Math.round(val(props.cols) ?? 64));
  const rows = (): number => Math.max(5, Math.round(val(props.rows) ?? 16));
  const list = computed((): readonly LedScene[] => {
    const s = val(props.scenes);
    if (s && s.length) return s;
    return [{ text: props.text ?? "" }];
  });
  const calm = (): boolean => still(props.motion);
  const audioGiven = signal<AudioSourceLike | undefined>(undefined);
  const audio = liveSource(() => audioGiven());

  // the board's own time: ms on the engine clock while playing and on screen
  const index = signal(0), held = signal(false), seen = signal(true), hover = signal(false);
  const out = signal(ledFrame(64, 16), { equals: false });
  const spoken = signal("");
  let face: ReturnType<typeof faceMotion> | null = null;
  const faceExpr = signal<LedScene | null>(null);

  const env = computed((): SceneEnv => {
    const r = rows(), sc = val(props.scale);
    return {
      cols: cols(), rows: r, font: val(props.font) ?? "5x7", spacing: Math.max(0, val(props.spacing) ?? 1),
      scale: sc === "auto" || sc == null ? Math.max(1, Math.min(3, Math.floor(r / 8))) : Math.max(1, Math.min(4, Math.round(sc))),
      direction: val(props.direction) ?? "left", speed: val(props.speed) ?? 30, pause: val(props.pause) ?? 1400,
      effect: val(props.effect) ?? "none", ink: ledColor(val(props.ink)), still: calm(),
      face: () => (face ? { state: face.state(), talk: face.talk() } : { state: { x: 0, y: 0, lid: 0, size: 1, pupil: 1, slant: 0, happy: 0, love: 0 }, talk: 0.5 }),
      audio: (given) => { if (untrack(audioGiven) !== given) audioGiven.set(given); return untrack(audio); },
    };
  });

  // the scene playing (and the one leaving during a transition)
  let cur: { i: number; c: Content; start: number } | null = null, prev: { c: Content; start: number } | null = null;
  let mixAt = -1, mixKind: LedTransition = "wipe", mixLen = 650, T = 0;
  let a = ledFrame(1, 1), b = ledFrame(1, 1);
  const enter = (i: number, withTransition: boolean): void => {
    const all = untrack(list), n = all.length;
    if (!n) return;
    const k = ((i % n) + n) % n, sc = all[k]!, e = untrack(env);
    if (cur && withTransition && !e.still) {
      prev = { c: cur.c, start: cur.start };
      mixAt = T; mixKind = sc.transition ?? untrack(() => val(props.transition)) ?? "wipe";
      mixLen = Math.max(1, untrack(() => val(props.transitionDuration)) ?? 650);
      if (mixKind === "cut") prev = null;
    } else prev = null;
    faceExpr.set(sc.eye || sc.mouth ? sc : untrack(faceExpr));
    cur = { i: k, c: contentOf(sc, e), start: T };
    index.set(k);
    spoken.set(cur.c.spoken());
    props.onScene?.(k, sc);
  };
  const render = (): void => {
    const e = untrack(env), c = e.cols, r = e.rows;
    let f = untrack(out);
    if (f.cols !== c || f.rows !== r) { f = ledFrame(c, r); a = ledFrame(c, r); b = ledFrame(c, r); }
    if (!cur) enter(untrack(index), false);
    if (!cur) { clearFrame(f); out.set(f); return; }
    // the scene is over: the next one (or stay on the last when not looping)
    if (T - cur.start >= cur.c.length) {
      const n = untrack(list).length, last = cur.i >= n - 1;
      if (!last || untrack(() => val(props.loop)) !== false) enter(cur.i + 1, n > 1);
      else cur.start = T - cur.c.length; // hold the last frame
    }
    const p = prev && mixAt >= 0 ? (T - mixAt) / mixLen : 1;
    if (prev && p < 1) {
      clearFrame(a); clearFrame(b);
      prev.c.draw(a, T - prev.start);
      cur.c.draw(b, T - cur.start);
      mixFrames(f, a, b, Math.max(0, p), mixKind);
    } else {
      prev = null;
      clearFrame(f);
      cur.c.draw(f, Math.min(T - cur.start, cur.c.length));
    }
    out.set(f);
  };

  // a new list or new options: start the scene again with them (same index when it still exists)
  effect(() => {
    list(); env();
    untrack(() => { const i = cur?.i ?? 0; cur = null; prev = null; enter(i < list().length ? i : 0, false); render(); });
  });

  const sr = h("span", { class: "m-sr-only", "aria-live": () => (val(props.live) === "off" ? "off" : "polite") }, () => spoken());
  // the screen is an LedMatrix (an image named by what it shows now); the board around it is the focusable region
  const screen = LedMatrix(screenProps(props, { frame: out, cols: undefined, rows: undefined, class: undefined, label: () => spoken() || t`LED board` }));
  const el: HTMLElement = h("div", {
    class: () => cx("m-led-board", val(props.class)), role: "region", "aria-label": () => val(props.label) ?? t`LED board`,
    "aria-roledescription": t`LED board`, tabindex: "0", "aria-keyshortcuts": "Space ArrowLeft ArrowRight",
    onKeyDown: (ev: KeyboardEvent) => {
      if (isActivateKey(ev)) { ev.preventDefault(); held.set(!untrack(held)); return; }
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      const fwd = (ev.key === "ArrowRight") !== isRtl(el);
      enter((cur?.i ?? 0) + (fwd ? 1 : -1), true); render();
    },
    onPointerEnter: () => hover.set(true), onPointerLeave: () => hover.set(false),
    "data-paused": () => (held() ? "" : null),
  }, screen, sr) as HTMLElement;
  onCleanup(watchVisibility(el, (v) => seen.set(v)));

  face = faceMotion(el, {
    expression: () => faceExpr()?.eye, look: () => undefined, mouth: () => faceExpr()?.mouth,
    alive: () => val(props.alive) !== false && !!faceExpr()?.eye && index() === list().indexOf(faceExpr()!),
    follow: () => !!val(props.follow), blinkEvery: () => undefined, still: calm,
  });

  // the clock: runs while playing, not held, on screen (and not hovered with pauseOnHover)
  effect(() => {
    if (val(props.playing) === false || held() || !seen() || (val(props.pauseOnHover) && hover())) return;
    onCleanup(onFrame((_, dt) => { T += dt; render(); }));
  });
  return el;
}
