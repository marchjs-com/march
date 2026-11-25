True when the value is already an AudioSource (made by `audioSource`), false for inputs such as `"mic"`, an element or a
number function.

```ts
if (!isAudioSource(x)) x = audioSource(x);
```
