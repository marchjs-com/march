# Button

The button. Five variants (`primary` is the theme's orange fill, `secondary` the default, `ghost`, `danger`, `dark`
ink fill), three sizes, a leading or trailing icon, `loading` (locks the button and shows a spinner instead of the
icon), `block` width, and `href` (renders a router link styled as a button).

`ActionButton` draws an `action()`: it is hidden when the user may not run it, disabled and busy while it runs, and the
action handles confirmation, the reason prompt and the success / error toasts.

```tsx
<Button variant="primary" icon={plus}>New project</Button>
<Button loading={$saving} on:click={save}>Save</Button>
<Button href="/docs" iconEnd={arrowRight}>Docs</Button>
<ActionButton action={remove} args={[row]} />
<Button loading={$saving} spinner={false} icon={save}>Save</Button>   // no spinner: the icon stays
<Button loading={$saving} spinner={<MyDots />}>Save</Button>          // your own busy mark
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `variant` | `primary` `secondary` `ghost` `danger` `dark` | `secondary` | |
| `size` | `sm` `md` `lg` | `md` | |
| `color` | ColorToken | theme primary | accent of the primary variant |
| `icon` / `iconEnd` | icon | — | leading / trailing icon |
| `loading` | boolean / accessor | — | spinner, `aria-busy`, disabled |
| `spinner` | boolean / node / icon | `true` | the loading spinner: `false` keeps the icon, a node or icon replaces it |
| `disabled` | boolean / accessor | — | |
| `block` | boolean | `false` | full width |
| `href` | Href | — | router link |
| `type` | `button` `submit` `reset` | `button` | |
| `class` | class | — | extra classes on the button |
| `children` | node | — | the label (`.hm-btn-label`) |

Other attributes (`onClick`, `title`, `aria-*`, `data-*`) go to the `<button>` / `<a>`.

ActionButton: `action`, `args`, `variant`, `size`, `color`, `spinner`, `icon`, `iconOnly`, `class`, `onDone`, `onError`,
`children` (replaces the action's label).

## Accessibility

A real `<button>` (or `<a>` with `href`); focus ring on keyboard focus; `aria-busy` while loading. An icon-only
ActionButton uses the action's label as its accessible name; a keyboard shortcut of the action shows in the title.
