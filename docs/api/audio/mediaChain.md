The audio path of an `<audio>` / `<video>` element: `{ input, output }`, made once for the element's whole life (an
element can feed only one MediaElementAudioSourceNode). By default `input → output → speakers`. Effects go between the
two: disconnect `input` from `output` and insert your nodes. Audio sources made from the element read `output`, so
meters show the processed sound. `null` without Web Audio.

```ts
const chain = mediaChain(video)!;
const eq = audioContext()!.createBiquadFilter();
chain.input.disconnect(chain.output);
chain.input.connect(eq).connect(chain.output);
```
