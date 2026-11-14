import { definePlayground } from "../../meta.ts";

interface Values { complete: boolean; multiline: boolean; message: boolean; hint: boolean; copy: boolean; flash: boolean; color: string; state: string }

export default definePlayground<Values>({
  options: [
    { key: "complete", label: "Öneri listesi", default: true },
    { key: "message", label: "Alt satır (durum)", default: true },
    { key: "hint", label: "Kısayol ipucu", default: true, visibleWhen: (v) => v.complete && v.message },
    { key: "copy", label: "Kopyala düğmesi", default: true, visibleWhen: (v) => v.message },
    { key: "flash", label: "Değişen yer parlar", default: true },
    { key: "multiline", label: "Enter yeni satır açar", default: true },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
    { key: "state", label: "Durum", default: "normal", options: [{ value: "normal", label: "normal" }, { value: "readonly", label: "salt okunur" }, { value: "disabled", label: "devre dışı" }] },
  ],
});
