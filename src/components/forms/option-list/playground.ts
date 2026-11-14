import { definePlayground } from "../../meta.ts";

interface Values { mode: string; field: boolean; icons: boolean; hints: boolean; trailing: boolean; groups: boolean; check: string; columns: number; size: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "field", label: "Bir alanın tuşlarıyla (keysFrom)", default: false },
    { key: "mode", label: "Tür", default: "radio", options: [{ value: "radio", label: "tek seçim (radyo)" }, { value: "listbox", label: "liste kutusu" }, { value: "multi", label: "çoklu seçim" }, { value: "menu", label: "komut menüsü" }], visibleWhen: (v) => !v.field },
    { key: "columns", label: "Sütun", default: 1, options: [1, 2], visibleWhen: (v) => !v.field },
    { key: "icons", label: "İkonlar", default: true },
    { key: "hints", label: "Açıklama satırı", default: true },
    { key: "trailing", label: "Sondaki parça (kısayol)", default: false },
    { key: "groups", label: "Grup başlıkları", default: false },
    { key: "check", label: "Seçim işareti", default: "on", options: [{ value: "on", label: "tik" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.field || v.mode !== "menu" },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    { key: "color", label: "Renk", default: "default", options: [{ value: "default", label: "aksan" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.field || v.mode !== "menu", prop: "m:color" },
  ],
});
