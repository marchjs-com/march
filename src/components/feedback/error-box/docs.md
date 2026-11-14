# ErrorBox

An error shown in place of the content that failed: the message of an `Error` (or any value, as text), an optional title and a "Retry" button.

```tsx
<ErrorBox title="Could not load" error={err} retry={() => refetch()} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `error` | `unknown` / accessor | | its `message`, or the value as text |
| `message` | `unknown` / accessor | | used when there is no `error` |
| `title` | node | | bold first line |
| `retry` | `() => unknown` | | adds a "Retry" button (translated) |
| `retryLabel` | text / node / accessor | "Retry" (translated) | what the retry button says |
| `class` | class value | | |

Without either, it says "Something went wrong." (translated); `message` replaces that text.

```tsx
<ErrorBox message="We could not reach the server." retry={reconnect} retryLabel="Reconnect" />
```

Parts carry `hm-errorbox-title`, `hm-errorbox-text` and `hm-errorbox-retry` for your own styles.

## Accessibility

`role="alert"`: the error is announced when it appears. The message is text (never HTML from the error). The retry
button is a native button in the reading order.

## Composed of

Nothing: a block with a native button.
