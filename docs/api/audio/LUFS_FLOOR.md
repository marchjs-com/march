−70 LUFS: the absolute gate of ITU-R BS.1770 and the floor of every `loudness()` reading (silence reads it). Blocks
quieter than this never count towards the integrated loudness.

```ts
const quiet = lu.momentary() <= LUFS_FLOOR;
```
