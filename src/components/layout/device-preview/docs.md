# DevicePreview

Shows content as on a real phone or tablet: the device body with its camera (island, punch hole or notch), the status
bar (time, signal, battery), the home indicator, the real screen size in CSS pixels, portrait or landscape. The mouse
acts like a finger: the cursor becomes a touch dot, dragging scrolls whatever is under it (with a fling that slows
down), a long press opens the context menu, a drag never also clicks.

The screen is an `OverlayScope` (drawers, dialogs and menus of the content open inside the device) and the `hm-site`
container (the website blocks answer to its width), so a site in it behaves as on the device.

```tsx
import { DevicePreview, DEVICES } from "hadi-march/layout";

<DevicePreview device="iphone-15"><MySite /></DevicePreview>
<DevicePreview device="ipad" landscape touch={false}>…</DevicePreview>
<DevicePreview device={{ name: "Kiosk", width: 1080, height: 1920, radius: 0, kind: "screen" }}>…</DevicePreview>
```

Devices: `iphone-15`, `iphone-se`, `pixel-8`, `galaxy-s24`, `ipad`, `ipad-pro` (`DEVICES`), or your own spec.

## Props

| Prop | |
|---|---|
| `device` | Device id or `{ name, width, height, radius?, kind?, camera? }` (reactive). |
| `landscape` | Rotate (reactive). |
| `touch` | Mouse acts as a finger (default true). |
| `fit` | Scale down to fit its place (default true). |
| `src` | A same-origin address shown in an iframe instead of children (reactive). |
| `label` | Accessible name of the device; default "<device> preview" (translated). |
| `statusBar` | The status bar: `true` (default), `false` (reactive), or your own node in its place. |
| `time` | Clock text of the status bar, e.g. `"9:41"` (default: the time now). |
| `homeIndicator` | `false` hides the home indicator line (reactive). |
| `camera` | `false` hides the camera of the device (reactive). |
| `class` | Class of the device (`.hm-device`); parts: `.hm-device-screen`, `.hm-device-status`, `.hm-device-viewport`, `.hm-device-camera`, `.hm-device-home`, `.hm-device-touch`. |

```tsx
<DevicePreview device="iphone-15" time="9:41" homeIndicator={false} camera={false} label="Checkout on a phone">…</DevicePreview>
<DevicePreview device="pixel-8" statusBar={<MyStatusBar />}>…</DevicePreview>      // statusBar={false}: none
```

## Accessibility

The device is a group named "<device> preview"; the status bar and decorations are hidden from assistive technology.
Keyboard use inside the screen is unchanged. The fling runs on the motion engine (reduced motion applies).

## Composed of

OverlayScope.
