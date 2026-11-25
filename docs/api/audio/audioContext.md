The one `AudioContext` every audio source shares, made on first use; `null` where there is no Web Audio (node, old
browsers). Use it for nodes of your own that a source should hear, so everything runs in one context.

```ts
const ctx = audioContext();
if (ctx) { const osc = ctx.createOscillator(); osc.start(); const src = audioSource(osc); await src.start(); }
```
