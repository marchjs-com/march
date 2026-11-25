One audio source for every meter and visualizer. Give it what to listen to; it gives readings.

```ts
import { audioSource } from "march/audio";
const demo = audioSource("demo");            // a synthesized loop: no file, no permission (silent unless audible: true)
const mic = audioSource("mic");              // the microphone: asks on start(), call it from a click
const song = audioSource(audioElement);      // an <audio> / <video> element; it keeps playing to the speakers
const call = audioSource(stream);            // a MediaStream
const load = audioSource(() => $cpu / 100);  // any number 0–1: the meters work without audio
await mic.start();
<LevelMeter source={mic} channels={2} />
```

Readings (signals): `level()` 0–1, `bands()` `{ bass, mid, treble }`, `channels()` `[left, right]`, `peak()` (unsmoothed),
`active()`, `error()` (`"unsupported"`, `"denied"` or a message). Arrays on demand: `waveform(out?, channel?)` (−1…1) and
`spectrum(out?)` (0–1 per bin; bin i is at `i × sampleRate() / fftSize` Hz).

Options: `fftSize` (default 2048), `smoothing` (0–0.99, default 0.8; levels rise at once and fall smoothly), `audible`
(send "mic" / "demo" to the speakers), `bandEdges` (default `[250, 4000]` Hz).

Readings update on the motion engine's clock only while something uses the source (`use(el)`, done by every audio
component) and that element is on screen; under reduced motion twice a second. `onUpdate(fn)` runs after each reading.
`stop()` lets the microphone go. A number input runs at once; every other input waits for `start()`.
