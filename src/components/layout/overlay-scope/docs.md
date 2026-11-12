# OverlayScope

A box that layers opened inside it open in. A drawer, a dialog, a menu or a toast of a site preview, a device frame, a
dashboard panel or a component demo stays in it instead of covering the whole page.

```tsx
import { OverlayScope } from "hadi-march/layout";

<OverlayScope class="preview"><MySite /></OverlayScope>      // its SiteNav drawer opens inside the preview

openDrawer(render)                         // inside a scope: in the scope (found from the component or the focus)
openDrawer(render, { target: "page" })     // the whole page anyway
<Portal layer="popover" target={el}>…</Portal>
```

- Fixed-positioned overlays cover the box: it is their containing block (`contain: layout`), so drawers and dialog
  backdrops need no change.
- A modal layer makes only the inside of the box inert; the rest of the page keeps working.
- Menus and tooltips place themselves by the box's edges and stay inside it.
- `overlayScopeFor(el?)` returns the scope a layer opened now belongs in.

## Props

| Prop | |
|---|---|
| `class` | Class of the box. |

Layers take `target`: `"nearest"` (default), `"page"`, or a scope element (`openDialog`, `openDrawer`, `<Portal>`).

## Accessibility

Focus moves into a dialog opened in the scope and back out on close as usual; while it is open, only the scope's inside
is inert, so the page outside (the showcase around a preview) stays reachable.

## Composed of

No other component.
