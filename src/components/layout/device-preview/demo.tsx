// Showcase stage for DevicePreview: a small app in a phone — drag to scroll, open its drawer (it stays in the device).
import { DevicePreview } from "./index.ts";
import { Button } from "../../actions/button/index.ts";
import { openDrawer } from "../../overlays/dialog/index.ts";

export const code = `<DevicePreview device="iphone-15" landscape={false} touch time="9:41" statusBar homeIndicator camera>
  <MyApp />          // its drawers and dialogs open inside the device
</DevicePreview>`

const ITEMS = Array.from({ length: 30 }, (_, i) => `HADİ etkinlik ${i + 1}`)

export default function DevicePreviewDemo(props: { values: { device: string; landscape: boolean; touch: boolean; statusBar: boolean; homeIndicator: boolean; camera: boolean } }) {
  return <DevicePreview device={() => props.values.device} landscape={() => props.values.landscape} touch={() => props.values.touch}
    statusBar={() => props.values.statusBar} homeIndicator={() => props.values.homeIndicator} camera={() => props.values.camera}>
    <div class="sc-dev-app">
      <header class="sc-dev-head"><strong>HADİ</strong>
        <Button size="sm" onClick={() => void openDrawer(() => <ul class="sc-dev-menu"><li>Akış</li><li>Etkinlikler</li><li>Profil</li></ul>, { title: "Menü", side: "end" })}>Menü</Button>
      </header>
      <ul class="sc-dev-list">{ITEMS.map((t) => <li>{t}</li>)}</ul>
    </div>
  </DevicePreview>
}
