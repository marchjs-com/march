import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Waveform",
  status: "experimental",
  category: "media",
  since: "0.3.17",
  summary: "The bars of a sound (voice message, podcast): from peaks, an audio file (decoded lazily) or a live march/audio source; playhead with played bars, chapter regions, seek by pointer and keyboard; decorative recording bars.",
  composedOf: [],
  behaviors: ["motion engine", "pointerDrag", "audio source", "audio canvas"],
  hubs: [],
});
