// LedEyes (march/ui): a pair of LED eyes that feel alive. They blink, look left, right, up and down, go wide with
// surprise, droop when sleepy, smile, frown, fall in love; on their own they blink now and then and glance around, and
// they can follow the pointer. A mouth (smile, grin, talk…) appears on a screen tall enough for it. Every move runs on
// the motion engine (springs for the gaze, tweens for the lids; face.ts): global speed and pause act on it, reduced
// motion or `motion={false}` shows each expression at once, off screen nothing runs.
import { signal, computed } from "../../../core/reactive.ts";
import { val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import { ledFrame, type LedFrame } from "../led-matrix/frame.ts";
import "./led-eyes.css";
import { cx } from "../../../ui/util.ts";
import { screenProps, type LedLookProps } from "../led-matrix/screen.ts";
import { LedMatrix } from "../led-matrix/index.ts";
import { drawFace, type EyeExpression, type MouthShape } from "./eyes.ts";
import { faceMotion, expressionWords, type FaceMotion } from "./face.ts";

export type { EyeExpression, MouthShape } from "./eyes.ts";

export interface LedEyesProps extends LedLookProps {
  /** "open" (default), "blink" (blinks once each time it is set), "closed", "look-left", "look-right", "look-up", "look-down", "surprised", "sleepy", "happy", "angry", "sad", "love". @tr "open" (varsayılan), "blink" (her verilişinde bir kez kırpar), "closed", "look-left", "look-right", "look-up", "look-down", "surprised", "sleepy", "happy", "angry", "sad", "love". */
  expression?: MaybeFn<EyeExpression | undefined>;
  /** Where the pupils look, `{ x, y }` from −1 to 1; overrides the expression's gaze. @tr Gözbebeklerinin baktığı yer, −1 ile 1 arası `{ x, y }`; ifadenin bakışını geçersiz kılar. */
  look?: MaybeFn<{ x?: number | undefined; y?: number | undefined } | undefined>;
  /** A mouth under the eyes (needs 10+ rows): "none" (default), "smile", "grin", "flat", "sad", "open", "o", "talk". @tr Gözlerin altında bir ağız (10+ satır gerekir): "none" (varsayılan), "smile", "grin", "flat", "sad", "open", "o", "talk". */
  mouth?: MaybeFn<MouthShape | undefined>;
  /** Blink now and then and glance around on their own (default true). @tr Kendiliğinden ara ara kırpar ve etrafa bakar (varsayılan true). */
  alive?: MaybeFn<boolean | undefined>;
  /** The eyes follow the pointer anywhere on the page. @tr Gözler sayfadaki işaretçiyi izler. */
  follow?: MaybeFn<boolean | undefined>;
  /** Time between the alive blinks: `[min, max]` ms. Default [2200, 5600]. @tr Kendiliğinden kırpmalar arasındaki süre: `[en az, en çok]` ms. Varsayılan [2200, 5600]. */
  blinkEvery?: MaybeFn<readonly [number, number] | undefined>;
  /** LEDs across. Default 32. @tr Yatayda LED sayısı. Varsayılan 32. */
  cols?: MaybeFn<number | undefined>;
  /** LEDs down. Default 12 (16 with a mouth). @tr Dikeyde LED sayısı. Varsayılan 12 (ağızla 16). */
  rows?: MaybeFn<number | undefined>;
  /** Accessible name; default describes the expression ("Eyes looking left"). @tr Erişilebilir ad; varsayılan ifadeyi anlatır ("Sola bakan gözler"). */
  label?: MaybeFn<string | undefined>;
  /** false or "none": every expression at once, no blinks or glances (as with reduced motion). @tr false ya da "none": her ifade anında, kırpma ve bakınma yok (azaltılmış harekette olduğu gibi). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<LedEyes expression="look-left" mouth="smile" follow />` */
export function LedEyes(props: LedEyesProps): Element {
  const cols = (): number => Math.max(8, Math.round(val(props.cols) ?? 32));
  const rows = (): number => Math.max(5, Math.round(val(props.rows) ?? ((val(props.mouth) ?? "none") === "none" ? 12 : 16)));
  let buf: LedFrame = ledFrame(1, 1);
  const face = signal<FaceMotion | null>(null);
  const frame = computed((): LedFrame => {
    const c = cols(), r = rows(), m = face();
    if (buf.cols !== c || buf.rows !== r) buf = ledFrame(c, r);
    buf.lit.fill(0); buf.rgb.fill(0);
    if (m) drawFace(buf, m.state(), val(props.mouth) ?? "none", m.talk());
    return buf;
  }, { equals: false });
  const el = LedMatrix(screenProps(props, { frame, cols: undefined, rows: undefined, label: () => val(props.label) ?? expressionWords(val(props.expression)), class: () => cx("m-led-eyes", val(props.class)) }));
  face.set(faceMotion(el, {
    expression: () => val(props.expression), look: () => val(props.look), mouth: () => val(props.mouth),
    alive: () => val(props.alive) !== false, follow: () => !!val(props.follow), blinkEvery: () => val(props.blinkEvery),
    still: () => still(props.motion),
  }));
  return el;
}
