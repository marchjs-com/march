// The `source` prop of every audio component (Gauge, LevelMeter, Oscilloscope, Spectrum, Waveform, AudioReactive) as an
// accessor (SAMPLE audio, the shared form): a source given later replaces
// the first one (the view follows it). A number stays one source that reads the prop live (a new loudness is no new
// source); anything else becomes a source once per value given (toAudioSource: kept when it is one, else made here and
// stopped when it is replaced or the view goes).
import { signal, computed, effect, untrack } from "../core/reactive.ts";
import { toAudioSource, type AudioSource, type AudioSourceLike } from "./index.ts";

const NUMBER = {};

/** `const source = liveSource(() => props.source)`; `source()` is the AudioSource now (null: none). */
export function liveSource(given: () => AudioSourceLike | null | undefined): () => AudioSource | null {
  const kind = computed(() => { const s = given(); return typeof s === "number" ? NUMBER : (s ?? null); });
  const made = signal<AudioSource | null>(null);
  effect(() => {
    const k = kind();
    untrack(() => made.set(k == null ? null : toAudioSource(k === NUMBER ? () => Number(given()) : (k as AudioSourceLike))));
  });
  return made;
}
