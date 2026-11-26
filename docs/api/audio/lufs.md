LUFS of a power: the sum of the channels' mean squares after K-weighting, as BS.1770 writes it
(−0.691 + 10·log10(power)), never below `LUFS_FLOOR` (−70). A full-scale 1 kHz sine in both channels reads about 0.

```ts
lufs(0.5)   // ≈ −3.7
lufs(0)     // −70
```
