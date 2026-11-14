import { definePlayground } from "../../meta.ts";

interface Values { count: number; create: boolean; menu: string; labels: boolean; variant: string; tint: string; badges: boolean; bubble: boolean; ring: string; motion: boolean }

export default definePlayground<Values>({
  options: [
    { key: "count", label: "Sekme sayısı", default: 4, kind: "segmented", options: [{ value: 3, label: "3" }, { value: 4, label: "4" }, { value: 5, label: "5" }, { value: 6, label: "6" }] },
    { key: "create", label: "Ortada Oluştur düğmesi", default: true },
    { key: "menu", label: "Oluştur menüsü", default: "fan", kind: "cards", options: [{ value: "none", label: "yok (tek eylem)" }, { value: "fan", label: "yelpaze" }, { value: "stack", label: "yığın" }, { value: "sheet", label: "alt sayfa" }] },
    { key: "labels", label: "Etiketler", default: true },
    { key: "badges", label: "Rozetler", default: true },
    { key: "variant", label: "Görünüm", default: "floating", kind: "cards", options: [{ value: "floating", label: "yüzen" }, { value: "flat", label: "düz" }] },
    { key: "tint", label: "Baloncuk rengi", default: "brand", kind: "cards", options: [{ value: "brand", label: "sekme rengi" }, { value: "accent", label: "tema vurgusu" }] },
    { key: "bubble", label: "Aktif sekme baloncuğu", default: true },
    { key: "ring", label: "Oluştur düğmesi halkası", default: "hadi", visibleWhen: (v) => v.create, options: [{ value: "hadi", label: "dört HADİ rengi" }, { value: "accent", label: "tema vurgusu" }, { value: "off", label: "yok" }] },
    { key: "motion", label: "Hareket", default: true },
  ],
});
