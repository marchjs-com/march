# PanelHeader

The bar on top of a panel: a dialog, a drawer, a window, a dock group, a card, a board column, an editor. A lead slot,
an icon, the title and a second line, free content, a count, the actions and the close button. Every part is optional
and yours to replace. `as="footer"` draws the same bar under a panel (status text + actions).

```tsx
<PanelHeader icon={settings} title="Settings" subtitle="Workspace" divider
  actions={<Button size="sm">Save</Button>} onClose={() => $open = false} />
<PanelHeader size="sm" tone="muted" title="index.ts" actions={<CopyButton text={code} />} />      // editor / code bar
<PanelHeader title="To do" meta={<Badge>{$cards.length}</Badge>} lead={<StatusDot />} />           // board column
<PanelHeader as="footer" title="3 changes" actions={<Button size="sm">Apply</Button>} divider />   // bottom bar
<PanelHeader drag title={$title} titleAs="span" titleId={id} ref={(bar) => track(bar, move)}
  role="toolbar" tabindex="0" onKeyDown={onKey} onDblClick={toggleMax} onClose={close} />          // window title bar
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `as` | `header` `footer` `div` | `header` | `footer`: the bar under a panel (rule above, sticks to the bottom) |
| `title` | node / accessor | — | |
| `titleAs` | `h1`–`h6` `span` `div` `p` | `h3` (`span` in a footer) | element of the title |
| `titleId` | string | — | id of the title (the panel's `aria-labelledby`) |
| `subtitle` | node / accessor | — | second line |
| `icon` | icon / node | — | before the title |
| `lead` | node | — | before everything: back button, status dot, grip |
| `meta` | node / accessor | — | right after the title: count, badge |
| `actions` | node / accessor | — | the end side |
| `children` | node | — | free content between titles and actions (tabs, search) |
| `onClose` | `(e) => void` | — | shows the close button |
| `close` | boolean / icon | shown with `onClose` | `false`: none; an icon or node: your own |
| `closeLabel` | string | "Close" | accessible name and tooltip of the close button |
| `size` | `sm` `md` `lg` | `md` | |
| `divider` | boolean | `false` | rule between the bar and the content |
| `sticky` | boolean | `false` | stays at the top (bottom for a footer) while the panel scrolls |
| `tone` | `plain` `muted` | `plain` | `muted`: the tinted bar of editors |
| `drag` | boolean | `false` | the bar is a drag handle (no text selection, no touch scrolling) |
| `align` | `center` `start` | `center` | cross-axis alignment of the parts |
| `color` | color token | — | colour of the icon |
| `ref` | `(el) => void` | — | the root element; attach a drag behavior here |
| `class` | class value | — | |
| `partClass` | `{ titles, title, subtitle, meta, actions }` | — | an extra class on a part (a host that keeps its own class names) |
| other | — | — | events, `role`, `tabindex`, `aria-*`, `id` go to the root |

## Accessibility

The root is a `<header>` (or `<footer>`); the title is a real heading (`titleAs`) whose `titleId` names the panel
through `aria-labelledby`. The close button is an IconButton with an accessible name (`closeLabel`); a press on it
never reaches the bar's own pointer handlers, so closing does not start a drag. A focusable bar (`tabindex`) shows the
focus ring. Text is cut with an ellipsis instead of pushing the actions out; logical properties mirror it in RTL.

## Composed of

IconButton (the close button).
