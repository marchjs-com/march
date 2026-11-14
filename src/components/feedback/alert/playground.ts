import { definePlayground } from "../../meta.ts";

interface Values { action: string; tone: string; color: string; icon: string; title: boolean; dismissable: boolean; dismissIcon: string }

export default definePlayground<Values>({
  options: [
    { key: "tone", label: "Ton", default: "info", kind: "cards", options: [{ value: "info", label: "bilgi" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }, { value: "neutral", label: "nötr" }] },
    { key: "color", label: "Renk", default: "tone", kind: "chips", options: [{ value: "tone", label: "tonun rengi" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }] },
    { key: "icon", label: "İkon", default: "tone", kind: "segmented", options: [{ value: "tone", label: "tonun ikonu" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "title", label: "Başlık", default: true },
    { key: "action", label: "Eylem düğmesi", default: "end", kind: "segmented", options: [{ value: "off", label: "yok" }, { value: "end", label: "metnin yanında" }, { value: "below", label: "metnin altında" }] },
    { key: "dismissable", label: "Kapatılabilir", default: true },
    { key: "dismissIcon", label: "Kapat düğmesi", default: "x", kind: "segmented", options: [{ value: "x", label: "çarpı" }, { value: "check", label: "onay işareti" }], visibleWhen: (v) => v.dismissable },
  ],
});
