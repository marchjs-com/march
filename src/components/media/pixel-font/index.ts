// PixelFont (march/ui): text in a pixel font on a small LED screen, as wide as the text (or a fixed number of LEDs with
// the text placed in it). The fonts are March's own: "5x7" with every Turkish letter and "8x8", a bolder face; `:heart:`
// puts a pixel emoji in the line. A still label, a badge, a heading in an LED style; LedBoard moves text, this one
// stands. Screen readers read the text itself.
import { computed } from "../../../core/reactive.ts";
import { val, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ledFrame, blit, ledColor, type LedFrame } from "../led-matrix/frame.ts";
import "./pixel-font.css";
import { cx } from "../../../ui/util.ts";
import { screenProps, type LedLookProps } from "../led-matrix/screen.ts";
import { LedMatrix } from "../led-matrix/index.ts";
import { layoutText, spokenText, type PixelFontName } from "./font.ts";

export { layoutText, wrapText, textWidth, type PixelFontName, type PixelTextOptions, type PixelText, type PixelTextPart } from "./font.ts";

export interface PixelFontProps extends LedLookProps {
  /** The text; `:name:` shows a pixel emoji (`:heart:`, `:star:`…). @tr Metin; `:ad:` bir piksel emoji gösterir (`:heart:`, `:star:`…). */
  text?: MaybeFn<string | number | undefined>;
  /** "5x7" (default) or "8x8" (bolder). @tr "5x7" (varsayılan) ya da "8x8" (daha kalın). */
  font?: MaybeFn<PixelFontName | undefined>;
  /** LEDs between letters. Default 1. @tr Harfler arasındaki LED sayısı. Varsayılan 1. */
  spacing?: MaybeFn<number | undefined>;
  /** Color of the letters ("#ff8a00"); default the screen's color. @tr Harflerin rengi ("#ff8a00"); varsayılan ekranın rengi. */
  ink?: MaybeFn<string | undefined>;
  /** Screen width in LEDs; default the text's width plus a margin. @tr LED cinsinden ekran genişliği; varsayılan metnin genişliği artı kenar boşluğu. */
  cols?: MaybeFn<number | undefined>;
  /** Where the text sits on a wider screen: "start", "center" (default) or "end". @tr Daha geniş ekranda metnin yeri: "start", "center" (varsayılan) ya da "end". */
  align?: MaybeFn<"start" | "center" | "end" | undefined>;
  /** LEDs of margin around the text. Default 1. @tr Metnin çevresindeki LED cinsinden boşluk. Varsayılan 1. */
  margin?: MaybeFn<number | undefined>;
  /** Accessible name; default the text (emoji tokens read as their names). @tr Erişilebilir ad; varsayılan metnin kendisi (emoji belirteçleri adlarıyla okunur). */
  label?: MaybeFn<string | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<PixelFont text="HADİ :heart:" color="amber" />` */
export function PixelFont(props: PixelFontProps): Element {
  const text = (): string => String(val(props.text) ?? "");
  const frame = computed((): LedFrame => {
    const m = Math.max(0, Math.round(val(props.margin) ?? 1));
    const laid = layoutText(text(), { font: val(props.font) ?? "5x7", spacing: val(props.spacing) ?? 1, rgb: ledColor(val(props.ink)) }).frame;
    const cols = Math.max(1, Math.round(val(props.cols) ?? laid.cols + m * 2)), rows = laid.rows + m * 2;
    const f = ledFrame(cols, rows), a = val(props.align) ?? "center";
    blit(f, laid, a === "start" ? m : a === "end" ? cols - m - laid.cols : Math.floor((cols - laid.cols) / 2), m);
    return f;
  });
  return LedMatrix(screenProps(props, { frame, cols: undefined, rows: undefined, label: () => val(props.label) ?? spokenText(text()), class: () => cx("m-pixel-font", val(props.class)) }));
}
