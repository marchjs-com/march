// Showcase stage for PropertyGrid: a card whose look follows the inspector (Playground values in playground.ts).
import { signal } from "../../../core/reactive.ts";
import { PropertyGrid, type PropertySpec } from "./index.ts";
import { toast } from "../../../ui/toast.ts";
import { cx } from "../../../ui/util.ts";

export const code = `<PropertyGrid label="Kart" bind:value={$card} onSave={(v) => api.save(v)} properties={[
  { key: "title", label: "Başlık", group: "İçerik" },
  { key: "width", label: "Genişlik", type: "number", unit: "px", group: "Yerleşim", validate: (v) => v > 420 ? "En çok 420" : null },
  { key: "elevated", label: "Gölge", type: "switch", group: "Görünüm" },
  { key: "radius", label: "Köşe", type: "slider", min: 0, max: 24, group: "Görünüm" },
  { key: "tone", label: "Ton", type: "segmented", options: ["açık", "koyu"], group: "Görünüm" },
]} />          // Ctrl+Z geri alır (Undo), sayfadan ayrılırken kaydedilmemiş değişikliği sorar (DirtyState)`

const PROPS: PropertySpec[] = [
  { key: "title", label: "Başlık", group: "İçerik", keywords: "ad isim" },
  { key: "body", label: "Metin", type: "textarea", group: "İçerik" },
  { key: "width", label: "Genişlik", type: "number", unit: "px", min: 160, max: 600, group: "Yerleşim", description: "160–420 px", validate: (v) => (Number(v) > 420 ? "En çok 420 px" : null) },
  { key: "align", label: "Hizalama", type: "select", options: [{ value: "start", label: "Başa" }, { value: "center", label: "Ortaya" }], group: "Yerleşim" },
  { key: "elevated", label: "Gölge", type: "switch", group: "Görünüm" },
  { key: "radius", label: "Köşe yarıçapı", type: "slider", min: 0, max: 24, group: "Görünüm" },
  { key: "tone", label: "Ton", type: "segmented", options: [{ value: "light", label: "Açık" }, { value: "accent", label: "Vurgulu" }], group: "Görünüm" },
  { key: "accent", label: "Vurgu rengi", type: "color", group: "Görünüm", hidden: (v) => v["tone"] !== "accent" },
]

export default function PropertyGridDemo(props: { values: { layout: string; search: boolean; save: boolean } }) {
  const card = signal<Record<string, unknown>>({ title: "HADİ bülteni", body: "Haftalık özet", width: 300, align: "start", elevated: true, radius: 12, tone: "light", accent: "#1d9ad6" })
  return <div class="sc-pg-stage">
    <div class="sc-pg-preview" aria-hidden="true">
      {() => {
        const c = card()
        return <div class={cx("sc-pg-card", c["elevated"] && "is-elevated", c["tone"] === "accent" && "is-accent", c["align"] === "center" && "is-center")}
          style={{ "--sc-pg-w": `${Math.min(Number(c["width"]) || 300, 420)}px`, "--sc-pg-r": `${c["radius"]}px`, "--sc-pg-accent": String(c["accent"]) }}>
          <strong>{String(c["title"])}</strong><p>{String(c["body"])}</p>
        </div>
      }}
    </div>
    <div class="sc-pg-panel">
      {() => <PropertyGrid properties={PROPS} value={card} label="Kart özellikleri" layout={props.values.layout as "auto"} search={props.values.search}
        onSave={props.values.save ? () => { toast("Kaydedildi", { kind: "success" }) } : undefined} />}
    </div>
  </div>
}
