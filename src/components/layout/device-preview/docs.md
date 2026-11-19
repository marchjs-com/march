# DevicePreview

Shows content as on a real device: a phone or tablet body with its camera (island, punch hole or notch), the status
bar (time, signal, Wi-Fi, battery), the home indicator — or a desktop browser window with its title bar and address —
at the real screen size in CSS pixels, portrait or landscape (the body turns into the new orientation with a motion).

On a touch screen the mouse becomes **fingers**: the cursor is a touch dot, a press leaves a fingerprint, and the
content gets real `TouchEvent`s (`touches`, `targetTouches`, `changedTouches`) and `PointerEvent`s with
`pointerType: "touch"` (one pointer per finger, implicitly captured; `setPointerCapture` works on them), never the
mouse's own events. A drag scrolls what is under it with a fling — unless `touchstart` / `touchmove` was prevented or
`touch-action` forbids it, as on a phone; a long press opens the context menu; a drag never also clicks.

- **Shift + drag**: two fingers mirrored around a pivot — pinch and rotate.
- **Fingers 1–3** (`fingers`, or the rail's hand button): a drag moves that many fingers side by side (two-finger
  scroll, three-finger swipe).
- **Gestures** (the rail's sparkle menu, or `ref` → `play()`): tap, double tap, long press, swipes, pinch in / out,
  rotate, two-finger scroll, three-finger swipes — played by themselves, fingers visible.

The screen is an `OverlayScope` (drawers, dialogs and menus of the content open inside the device) and the `m-site`
container (the website blocks answer to its width), so a site in it behaves as on the device.

```tsx
import { DevicePreview, DEVICES } from "march/layout";

<DevicePreview device="iphone-15"><MySite /></DevicePreview>
<DevicePreview device="ipad" landscape={$land} controls>…</DevicePreview>
<DevicePreview device={{ name: "Kiosk", width: 1080, height: 1920, radius: 0, kind: "screen" }}>…</DevicePreview>
```

## Devices

About 35 in `DEVICES`: iPhone SE … 16 Pro Max, Pixel 7 / 8 / 9 Pro, Galaxy S24 / S24 Ultra / A54 / Z Flip / Z Fold
(folded and open), Xiaomi, OnePlus, Nothing; iPad mini, iPad, iPad Pro 11 / 12.9, Galaxy Tab S9, Pixel Tablet, Surface
Pro; desktop windows from 1280 × 800 to 4K; a portrait kiosk. Each has its CSS size, pixel ratio (`dpr`), corner
radius, camera and whether it is a touch screen. Your own devices: `addDevice({ name, width, height, dpr, kind, touch })`
(saved in this browser, `customDevices`, `removeDevice`), or pick and make them with **DevicePicker**.

## The control rail (`controls`)

A rail beside the device plays what a real device feels and tells the page:

| Button | What the content gets |
|---|---|
| Turn | `orientationchange`, `screen.orientation` `change`, `resize`; `screen.orientation.type` / `angle`, `window.orientation` follow |
| Fingers / Gestures | touch and pointer events (see above) |
| Shake | `devicemotion` events (acceleration, rotation rate) for about a second; the body shakes |
| Tilt | `deviceorientation` (alpha, beta, gamma) on every change; the body leans with it |
| Offline | `offline` / `online`; `navigator.onLine` |
| Battery | `navigator.getBattery()` answers; `levelchange`, `chargingchange`; the status bar shows it |
| Background | `visibilitychange`, `pagehide` / `pageshow`; `document.hidden`, `visibilityState` |
| Keyboard | an on-screen keyboard that types into the focused field (`input` events); the page above gets smaller. With `keyboard="auto"` (default) it opens by itself when a field gets focus on a touch device |

`devicePixelRatio` is the device's too. Every event fired shows for a moment under the device (`events`).

When the content shares the page with others (no `src`), `scope` limits these values to some code: a `CallScope`
looks at the call stack (`(stack) => /blob:/.test(stack)`: code from blob: modules); the page around keeps its own.

## Props

| Prop | |
|---|---|
| `device` | Device id (catalog or yours) or a `DeviceSpec` (reactive). |
| `landscape` | Turn sideways (reactive; a signal lets the rail turn it too). |
| `touch` | Mouse acts as fingers (default: the device's — phones and tablets). |
| `fit` | Scale down to fit its place: `true` (default: its width and a sensible height), `"contain"` (width and height), `false`. |
| `fitHeight` | The most height the fitted device may take, in px (default: the window's height − 160, at least 480). |
| `src` | A same-origin address shown in an iframe instead of children (reactive); the fingers and device events work in it. |
| `controls` | The control rail (default false). |
| `fingers` | Signal of the finger count 1–3. |
| `keyboard` | `"auto"` (default), `true`, `false`. |
| `events` | Show the fired events under the device (default: with `controls`). |
| `scope` | Whose calls see the device's values (default every call). |
| `address` | The desktop window's address text (default the page's host). |
| `onEvent` | `(name, detail)` for each device event. |
| `ref` | Receives `{ play(gesture), shake(), sensors() }`. |
| `label` | Accessible name of the device; default "<device> preview" (translated). |
| `statusBar` | The status bar: `true` (default), `false` (reactive), or your own node in its place. |
| `time` | Clock text of the status bar, e.g. `"9:41"` (default: the time now). |
| `homeIndicator` | `false` hides the home indicator line (reactive). |
| `camera` | `false` hides the camera of the device (reactive). |
| `class` | Class of the device (`.m-device`); parts: `.m-device-screen`, `.m-device-bar`, `.m-device-status`, `.m-device-viewport`, `.m-device-kb`, `.m-device-camera`, `.m-device-home`, `.m-device-touch`, `.m-device-finger`, `.m-device-rail`, `.m-device-log`. |

```tsx
<DevicePreview device="iphone-15" time="9:41" homeIndicator={false} camera={false} label="Checkout on a phone">…</DevicePreview>
<DevicePreview device="pixel-8" statusBar={<MyStatusBar />}>…</DevicePreview>      // statusBar={false}: none
<DevicePreview device="pixel-8" ref={(d) => d.play("pinch-out")}>…</DevicePreview>
```

The parts are exported too: `touchSim` (the fingers on any surface), `deviceSensors` (the device events for any
window), `GESTURES`.

## Accessibility

The device is a group named "<device> preview"; the status bar, keyboard and decorations are hidden from assistive
technology; the rail is a vertical toolbar of named buttons. Keyboard use inside the screen is unchanged. The fling,
the turn and the shake run on the motion engine (global speed and reduced motion apply).

## Composed of

OverlayScope, IconButton, Button, Menu, Popover, Slider, Toggle.
