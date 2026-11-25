// What the audio views say to screen readers (Oscilloscope, Spectrum): a level in words and a frequency, translated.
// One place, so every view names the same loudness the same way. Turkish: src/i18n/tr.ts.
import { t, locale } from "../../../core/i18n.ts";

/** A level 0–1 in words: silent, quiet, moderate, loud, very loud (translated). */
export function levelInWords(level: number): string {
  return level < 0.02 ? t`silent` : level < 0.15 ? t`quiet` : level < 0.45 ? t`moderate` : level < 0.8 ? t`loud` : t`very loud`;
}

/** A frequency for reading: "220 Hz", "2,4 kHz" (the active locale's digits). */
export function hzInWords(hz: number): string {
  const nf = new Intl.NumberFormat(locale(), { maximumFractionDigits: hz >= 1000 ? 1 : 0 });
  return hz >= 1000 ? `${nf.format(hz / 1000)} kHz` : `${nf.format(hz)} Hz`;
}
