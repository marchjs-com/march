Turns a `source` prop into an AudioSource: an AudioSource is kept as it is; anything else (`"demo"`, an element, a
stream, a number function) becomes a new source that stops with the current owner. Every audio component reads its
`source` prop through it.

```ts
const src = toAudioSource(props.source);
src.use(root);
src.onUpdate(() => draw(src.level()));
```
