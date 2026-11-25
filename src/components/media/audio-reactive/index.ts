// AudioReactive (march/media): a wrapper that makes anything move with a sound. On each reading of its `source`
// (march/audio: a microphone, an <audio>, a call's stream, the "demo" loop or any number 0–1) it writes five CSS
// variables on itself, each 0–1: --m-level, --m-bass, --m-mid, --m-treble and --m-peak. Your CSS reads them
// (`scale: calc(1 + var(--m-level) * .1)`), or a ready effect does: pulse, glow, ring, bounce. The variables are
// written in the clock's write phase, only while the wrapper is on screen; with reduced motion twice a second.
import "./audio-reactive.css";
import { h } from "../../../dom/h.ts";
import { onCleanup } from "../../../core/reactive.ts";
import { val, cx, rest, clamp, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { mutate } from "../../../motion/engine/clock.ts";
import { toAudioSource, type AudioSourceLike } from "../../../audio/index.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** The readings AudioReactive can write. @tr AudioReactive'in yazabildiği okumalar. */
export type AudioVar = "level" | "bass" | "mid" | "treble" | "peak";
/** One reading of every variable, each 0–1. @tr Her değişkenin bir okuması, her biri 0–1. */
export type AudioLevels = Record<AudioVar, number>;
/** A ready effect that reads the variables. @tr Değişkenleri okuyan hazır bir efekt. */
export type AudioEffect = "pulse" | "glow" | "ring" | "bounce";

const ALL: readonly AudioVar[] = ["level", "bass", "mid", "treble", "peak"];

export interface AudioReactiveProps {
  /** What it listens to: an AudioSource or what makes one ("mic", "demo", an <audio>, a MediaStream, a number accessor 0–1). @tr Neyi dinlediği: bir AudioSource ya da onu yapan şey ("mic", "demo", bir <audio>, bir MediaStream, 0–1 bir sayı erişimcisi). */
  source: AudioSourceLike;
  /** The element's tag. Default "div". @tr Öğenin etiketi. Varsayılan "div". */
  as?: string | undefined;
  /** Multiplies every reading (then clamped to 1): above 1 for quiet sources. Default 1. @tr Her okumayı çarpar (sonra 1'e sıkıştırılır): sessiz kaynaklar için 1'in üstü. Varsayılan 1. */
  gain?: MaybeFn<number | undefined>;
  /** Extra smoothing of the fall on top of the source's (a rise is at once), 0 (none, default) – 0.99. @tr Kaynağınkinin üstüne düşüşte ek yumuşatma (yükseliş anında), 0 (yok, varsayılan) – 0,99. */
  smoothing?: MaybeFn<number | undefined>;
  /** Which variables to write: a list (`["level", "bass"]`), or names per reading (`{ level: "--talk", peak: false }`; false leaves one out). Default all five as --m-level… @tr Hangi değişkenlerin yazılacağı: bir liste (`["level", "bass"]`) ya da okuma başına adlar (`{ level: "--talk", peak: false }`; false birini dışarıda bırakır). Varsayılan beşi de --m-level… olarak. */
  vars?: MaybeFn<readonly AudioVar[] | Partial<Record<AudioVar, string | false>> | undefined>;
  /** Ready effects (they read the default names): "pulse" (scales), "glow" (a soft light), "ring" (a growing ring), "bounce" (jumps on the bass); one or a list. @tr Hazır efektler (varsayılan adları okur): "pulse" (büyür), "glow" (yumuşak ışık), "ring" (büyüyen halka), "bounce" (basta zıplar); biri ya da bir liste. */
  effect?: MaybeFn<AudioEffect | readonly AudioEffect[] | false | null | undefined>;
  /** Theme color token of the glow and the ring. Default the accent. @tr Işıltının ve halkanın tema renk belirteci. Varsayılan vurgu rengi. */
  color?: MaybeFn<ColorToken | undefined>;
  /** How strong the effects are, 0–2. Default 1. @tr Efektlerin gücü, 0–2. Varsayılan 1. */
  intensity?: MaybeFn<number | undefined>;
  /** false: the variables stay 0 (nothing moves). @tr false: değişkenler 0'da kalır (hiçbir şey kıpırdamaz). */
  motion?: MaybeFn<boolean | undefined>;
  /** Called after each reading with the values written (after the gain). @tr Her okumadan sonra yazılan değerlerle çağrılır (kazançtan sonra). */
  onLevel?: ((levels: AudioLevels) => void) | undefined;
  /** Extra class on the element (`m-ar`). @tr Öğeye (`m-ar`) eklenen sınıf. */
  class?: ClassProp;
  /** What moves with the sound. @tr Sesle hareket eden içerik. */
  children?: unknown;
  /** Other attributes (`role`, `aria-label`, `data-*`, `id`) go to the element. */
  [attr: string]: unknown;
}

/** The CSS variable name of each reading under `vars` (null: not written). */
export function audioVarNames(vars: AudioReactiveProps["vars"]): Record<AudioVar, string | null> {
  const v = val(vars);
  const out = {} as Record<AudioVar, string | null>;
  for (const k of ALL) {
    const named = !v || Array.isArray(v) ? undefined : (v as Partial<Record<AudioVar, string | false>>)[k];
    const n = Array.isArray(v) ? ((v as readonly AudioVar[]).includes(k) ? `--m-${k}` : null) : named === false ? null : (named || `--m-${k}`);
    out[k] = n == null ? null : n.startsWith("--") ? n : `--${n}`;
  }
  return out;
}

/** `<AudioReactive source={mic} effect="ring"><Avatar … /></AudioReactive>` */
export function AudioReactive(props: AudioReactiveProps): Element {
  const effects = (): string[] => { const e = val(props.effect); return !e ? [] : (Array.isArray(e) ? e : [e]).map((x) => `m-ar-${x}`); };
  const el = h(props.as || "div", {
    ...rest(props, ["source", "as", "gain", "smoothing", "vars", "effect", "color", "intensity", "motion", "onLevel", "children"]),
    class: () => cx("m-ar", effects(), val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)),
    style: () => ({ "--m-ar-k": clamp(val(props.intensity) ?? 1, 0, 2) }),
  }, props.children) as HTMLElement;

  // SAMPLE audio: read on the clock while on screen, write in the write phase
  const src = toAudioSource(props.source);
  src.use(el);
  const cur: AudioLevels = { level: 0, bass: 0, mid: 0, treble: 0, peak: 0 };
  const shown: Partial<Record<string, string>> = {};
  let queued = false, gone = false;
  onCleanup(() => { gone = true; });
  const write = (report = true): void => {
    queued = false;
    if (gone) return;
    const names = audioVarNames(props.vars);
    for (const k of ALL) {
      const name = names[k];
      if (!name) continue;
      const text = cur[k].toFixed(3);
      if (shown[name] !== text) { shown[name] = text; el.style.setProperty(name, text); }
    }
    if (report) props.onLevel?.({ ...cur });
  };
  onCleanup(src.onUpdate((s) => {
    const off = val(props.motion) === false, g = Math.max(0, val(props.gain) ?? 1), sm = clamp(val(props.smoothing) ?? 0, 0, 0.99);
    const b = s.bands();
    const next: AudioLevels = { level: s.level(), bass: b.bass, mid: b.mid, treble: b.treble, peak: s.peak() };
    for (const k of ALL) {
      const x = off ? 0 : clamp(next[k] * g, 0, 1);
      // the peak stays sharp; the rest may be smoothed further
      cur[k] = k === "peak" || x > cur[k] ? x : cur[k] * sm + x * (1 - sm);
    }
    if (!queued) { queued = true; mutate(() => write()); }
  }));
  write(false); // every variable starts at 0, so CSS that reads it works before the first reading
  return el;
}
