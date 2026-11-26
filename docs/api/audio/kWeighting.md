The two biquad filters of the K-weighting in ITU-R BS.1770 (a high shelf of about +4 dB above 1.5 kHz, then the RLB
high-pass at about 38 Hz), derived for any sample rate: `[shelf, highPass]`, each `[b0, b1, b2, a1, a2]` (a0 = 1).
`loudness()` uses them; use them yourself to K-weight samples in an AudioWorklet or offline.

```ts
const [shelf, high] = kWeighting(48000);
// y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2], shelf first
```
