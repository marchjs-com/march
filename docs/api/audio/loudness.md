The loudness readings of an audio source, as a broadcast or streaming loudness meter shows them: `momentary` (the last
400 ms) and `shortTerm` (the last 3 s) loudness in LUFS, the gated `integrated` loudness since the start or the last
`reset()`, and the stereo `correlation` (−1 out of phase … 0 unrelated … +1 mono). Each is a signal that updates with the
source's readings (only while something `use`s the source and it is on screen; twice a second under reduced motion).
The K-weighting and the gating follow ITU-R BS.1770 on the waveform window the source reads per frame: within a few
tenths of a dB on steady material, enough to aim at a target (−14 LUFS streaming, −23 LUFS broadcast). Silence reads
−70 (`LUFS_FLOOR`). It stops with the current owner, or with `stop()`. LoudnessGraph draws these as a history.

```ts
const song = audioSource(audioEl);
const lu = loudness(song);
song.use(meterEl);
effect(() => { if (lu.shortTerm() > -13) warn("Too loud for streaming"); });
lu.reset();   // a new track: the integrated loudness starts again
```
