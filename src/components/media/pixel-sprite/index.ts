// PixelSprite (march/ui): a pixel drawing on an LED screen, still or animated frame by frame: a built-in emoji or icon
// by name (`name="heart"`) or your own `.led.json` sprite (`{ fps, palette, frames }`). The frames advance on the motion
// engine's clock: global speed and pause act on them, reduced motion shows the first frame, off screen nothing runs.
import { signal, computed, effect, onCleanup, untrack } from "../../../core/reactive.ts";
import { val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { t } from "../../../core/i18n.ts";
import { onFrame, now } from "../../../motion/engine/clock.ts";
import { watchVisibility } from "../../../motion/engine/visibility.ts";
import { still } from "../../../motion/engine/parts.ts";
import { ledFrame, blit, type LedFrame } from "../led-matrix/frame.ts";
import "./pixel-sprite.css";
import { cx } from "../../../ui/util.ts";
import { screenProps, type LedLookProps } from "../led-matrix/screen.ts";
import { LedMatrix } from "../led-matrix/index.ts";
import { spriteOf, spriteFrames, spriteAt, type LedSprite } from "./sprites.ts";

export { LED_SPRITE_NAMES, defineSprite, parseLedJson, type LedSprite } from "./sprites.ts";

export interface PixelSpriteProps extends LedLookProps {
  /** A built-in sprite's name ("heart", "fire", "rocket"…; LED_SPRITE_NAMES lists them) or your own sprite (`.led.json`). @tr Hazır bir çizimin adı ("heart", "fire", "rocket"…; LED_SPRITE_NAMES hepsini listeler) ya da kendi çiziminiz (`.led.json`). */
  sprite?: MaybeFn<string | LedSprite | undefined>;
  /** Frames per second; default the sprite's own (4). @tr Saniyedeki kare sayısı; varsayılan çizimin kendi değeri (4). */
  fps?: MaybeFn<number | undefined>;
  /** Play the frames (default true); false shows one frame. @tr Kareleri oynatır (varsayılan true); false tek kare gösterir. */
  playing?: MaybeFn<boolean | undefined>;
  /** The frame shown while not playing (default 0). @tr Oynatılmazken gösterilen kare (varsayılan 0). */
  frameIndex?: MaybeFn<number | undefined>;
  /** Screen size in LEDs; default the sprite's size. A bigger screen centers the sprite. @tr LED cinsinden ekran boyutu; varsayılan çizimin boyutu. Daha büyük ekran çizimi ortalar. */
  cols?: MaybeFn<number | undefined>;
  /** Screen height in LEDs; default the sprite's height. @tr LED cinsinden ekran yüksekliği; varsayılan çizimin yüksekliği. */
  rows?: MaybeFn<number | undefined>;
  /** Accessible name; default the sprite's name. @tr Erişilebilir ad; varsayılan çizimin adı. */
  label?: MaybeFn<string | undefined>;
  /** false or "none": no frame animation (as with reduced motion). @tr false ya da "none": kare animasyonu yok (azaltılmış harekette olduğu gibi). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<PixelSprite sprite="fire" color="rgb" pitch={14} />` */
export function PixelSprite(props: PixelSpriteProps): Element {
  const sprite = computed(() => spriteOf(val(props.sprite)) ?? spriteOf("heart")!);
  const time = signal(0);
  const frame = computed((): LedFrame => {
    const s = sprite(), frames = spriteFrames(s);
    const play = val(props.playing) !== false && !still(props.motion) && frames.length > 1;
    const fps = val(props.fps);
    const pic = play ? spriteAt(fps ? { ...s, fps } : s, time()) : frames[Math.max(0, Math.min(frames.length - 1, Math.round(val(props.frameIndex) ?? 0)))]!;
    const cols = Math.max(1, Math.round(val(props.cols) ?? s.w ?? pic.cols)), rows = Math.max(1, Math.round(val(props.rows) ?? s.h ?? pic.rows));
    if (cols === pic.cols && rows === pic.rows) return pic;
    const f = ledFrame(cols, rows);
    blit(f, pic, Math.floor((cols - pic.cols) / 2), Math.floor((rows - pic.rows) / 2));
    return f;
  });
  const el = LedMatrix(screenProps(props, {
    frame, cols: undefined, rows: undefined, class: () => cx("m-pixel-sprite", val(props.class)),
    label: () => {
      const l = val(props.label);
      if (l) return l;
      const s = val(props.sprite);
      return typeof s === "string" ? s.replace(/-/g, " ") : t`Pixel drawing`;
    },
  }));
  // the frames run on the engine's clock, only while animated, playing and on screen
  let seen = true;
  const live = signal(true);
  onCleanup(watchVisibility(el, (on) => { seen = on; live.set(on); }));
  effect(() => {
    if (!live() || val(props.playing) === false || still(props.motion) || spriteFrames(sprite()).length < 2) return;
    const start = untrack(time) - now();
    onCleanup(onFrame((at) => { if (seen) time.set(start + at); }));
  });
  return el;
}
