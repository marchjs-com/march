import { definePlayground } from "../../meta.ts";

export default definePlayground<{ firstDay: string; window: boolean; color: string; weekdays: boolean; nav: string; busy: boolean }>({
  options: [
    { key: "firstDay", label: "Hafta başı", default: "locale", options: [{ value: "locale", label: "dilden" }, { value: "1", label: "Pazartesi" }, { value: "0", label: "Pazar" }, { value: "6", label: "Cumartesi" }] },
    { key: "window", label: "Yalnız yakın günler (min / max)", default: false },
    { key: "color", label: "Renk", default: "primary", kind: "chips", options: [{ value: "primary", label: "tema" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }, { value: "brand-pink", label: "pembe" }] , prop: "m:color"},
    { key: "weekdays", label: "Gün adları satırı", default: true },
    { key: "nav", label: "Ay düğmeleri", default: "chevron", options: [{ value: "chevron", label: "oklar" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok" }] },
    { key: "busy", label: "Dolu günleri işaretle (kendi gün içeriğim)", default: false },
  ],
});
