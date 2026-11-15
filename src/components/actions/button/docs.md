# Button

The button. Six variants (`primary` is the theme's orange fill, `secondary` the default, `ghost`, `danger`, `dark`
ink fill, `link` text that reads as a link and flows inline), three sizes, a leading or trailing icon, `loading` (locks
the button and shows a spinner instead of the icon), `block` width, `shape="pill"`, `pressed` (a toggle button) and
`href` (renders a router link styled as a button).

`ActionButton` draws an `action()`: it is hidden when the user may not run it, disabled and busy while it runs, and the
action handles confirmation, the reason prompt and the success / error toasts. It also draws a plain
`{ label, run, visible?, disabled?, busy?, opts? }` object, the shape of a table's row and bulk actions.

```tsx
<Button variant="primary" icon={plus}>New project</Button>
<Button loading={$saving} on:click={save}>Save</Button>
<Button href="/docs" iconEnd={arrowRight}>Docs</Button>
<ActionButton action={remove} args={[row]} />
<Button loading={$saving} spinner={false} icon={save}>Save</Button>   // no spinner: the icon stays
<Button loading={$saving} spinner={<MyDots />}>Save</Button>          // your own busy mark
<p>3 comments. <Button variant="link" on:click={showAll}>View all</Button></p>   // inline text button
<Button variant="ghost" pressed={$wrap} on:click={() => { $wrap = !$wrap }}>Wrap</Button>   // toggle: aria-pressed + pressed look
<Button variant="primary" shape="pill" icon={arrowUp}>12 new posts</Button>
<ActionButton action={{ label: "Archive", run: archive }} args={[row]} role="menuitem" />   // a plain action; other attributes go to the button
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `variant` | `primary` `secondary` `ghost` `danger` `dark` `link` | `secondary` | `link`: no fill or padding, inherits the font of the text around it; `color` tints it |
| `size` | `sm` `md` `lg` | `md` | the icons follow it |
| `weight` | `light` `regular` `medium` `strong` | `medium` | the label's font weight, in the theme's font |
| `m:color` | ColorToken | theme primary | Common prop (hadi-march/props): the colour token of the component and everything in it. |
| `icon` / `iconEnd` | icon | — | leading / trailing icon |
| `loading` | boolean / accessor | — | spinner, `aria-busy`, disabled |
| `spinner` | boolean / node / icon | `true` | the loading spinner: `false` keeps the icon, a node or icon replaces it (an icon turns) |
| `disabled` | boolean / accessor | — | |
| `block` | boolean | `false` | full width |
| `shape` | `pill` | — | fully rounded ends |
| `pressed` | boolean / accessor | — | toggle button: `aria-pressed` and the pressed look (`is-pressed`: tinted on `secondary` / `ghost`, pressed in on the filled variants, bolder on `link`); unset: a plain button |
| `href` | Href | — | router link; an external address (`https://…`, `mailto:`) is a plain link |
| `type` | `button` `submit` `reset` | `button` | |
| `class` | class | — | extra classes on the button |
| `children` | node | — | the label (`.m-btn-label`) |

Other attributes (`onClick`, `title`, `aria-*`, `data-*`) go to the `<button>` / `<a>`.

ActionButton: `action` (an `action()` or a plain `{ label, run }`), `args`, `run` (runs instead of `action.run`),
`variant`, `size`, `color`, `spinner`, `icon`, `iconOnly`, `shape`, `block`, `class`, `onDone`, `onError`, `children`
(replaces the action's label). Other attributes (`role`, `title`, `onClick`, `data-*`) go to the button.

## Accessibility

A real `<button>` (or `<a>` with `href`); focus ring on keyboard focus; `aria-busy` while loading; `aria-pressed`
when `pressed` is given (not on a link). An icon-only
ActionButton uses the action's label as its accessible name; a keyboard shortcut of the action shows in the title.

## Composed of

Spinner (its ring alone, `spinnerRing` from `feedback/spinner/core.ts`: no texts, no colour lists).
