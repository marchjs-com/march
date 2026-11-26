// LedMatrix (march/ui): a dot-matrix screen of LEDs on a canvas. It paints a picture (an LedFrame, or pixel art as
// text) and, on every change, repaints only the LEDs that changed; off screen it paints nothing and catches up when it
// comes back. Looks: round LEDs, square pixels or glow tubes, the gap and roundness, a bloom halo, the faint ghost of
// unlit LEDs, scanlines; one color (amber, green, red, blue, white, a theme token) or full RGB on the theme's accent.
// PixelFont, PixelSprite, LedEyes and LedBoard draw on it (the shared screen is in screen.ts).
import "./led-matrix.css";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ledFrame, blit } from "./frame.ts";
import { ledScreen, pictureOf, type LedLookProps, type LedPicture } from "./screen.ts";

export { ledFrame, ledArt, setLed, blit, ledColor, type LedFrame } from "./frame.ts";
export type { LedShape, LedColor, LedPicture, LedLookProps } from "./screen.ts";

export interface LedMatrixProps extends LedLookProps {
  /** The picture: an LedFrame (from ledFrame / ledArt) or pixel art as text, one string per row ("." off). A function is followed live. @tr Resim: bir LedFrame (ledFrame / ledArt ile) ya da satır başına bir dize olan piksel çizimi ("." sönük). Fonksiyon verilirse canlı izlenir. */
  frame?: MaybeFn<LedPicture>;
  /** Colors of the art's characters: `{ r: "#f33", y: "#fc0" }`. @tr Çizimdeki karakterlerin renkleri: `{ r: "#f33", y: "#fc0" }`. */
  palette?: MaybeFn<Record<string, string> | undefined>;
  /** LEDs across; default the picture's width (32 without one). @tr Yatayda LED sayısı; varsayılan resmin genişliği (resim yoksa 32). */
  cols?: MaybeFn<number | undefined>;
  /** LEDs down; default the picture's height (8 without one). @tr Dikeyde LED sayısı; varsayılan resmin yüksekliği (resim yoksa 8). */
  rows?: MaybeFn<number | undefined>;
  /** Accessible name: what the screen shows (default "LED display"). @tr Erişilebilir ad: ekranın gösterdiği (varsayılan "LED ekran"). */
  label?: MaybeFn<string | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<LedMatrix frame={[".#.#.", "#####", ".###.", "..#.."]} color="red" />` */
export function LedMatrix(props: LedMatrixProps): Element {
  const pic = pictureOf(() => val(props.frame), () => val(props.palette));
  const cols = (): number => Math.max(1, Math.round(val(props.cols) ?? (pic().cols || 32)));
  const rows = (): number => Math.max(1, Math.round(val(props.rows) ?? (pic().rows || 8)));
  // the picture on a screen of cols × rows, centered (a picture of that size is used as it is)
  const out = signal(ledFrame(1, 1), { equals: false });
  effect(() => {
    const p = pic(), c = cols(), r = rows();
    if (p.cols === c && p.rows === r) return void out.set(p);
    const f = untrack(out).cols === c && untrack(out).rows === r && untrack(out) !== p ? untrack(out) : ledFrame(c, r);
    f.lit.fill(0); f.rgb.fill(0);
    blit(f, p, Math.floor((c - p.cols) / 2), Math.floor((r - p.rows) / 2));
    out.set(f);
  });
  return ledScreen(props, out, () => val(props.label) ?? t`LED display`, props.class);
}

