import { definePlayground } from "../../meta.ts";

interface Values { lineNumbers: boolean; complete: boolean; multiline: boolean; message: boolean; keys: boolean; shortcuts: boolean; tabSize: number; copy: boolean; flash: boolean; color: string; state: string }

export default definePlayground<Values>({
  options: [
    { key: "complete", label: "Öneri listesi", default: true },
    { key: "lineNumbers", label: "Satır numaraları (tıkla: işaret)", default: false },
    { key: "message", label: "Alt satır (durum)", default: true },
    { key: "keys", label: "IDE tuşları (Tab, Ctrl+/, Alt+↑↓…)", default: true },
    { key: "tabSize", label: "Girinti (boşluk)", default: 2, options: [{ value: 2, label: "2" }, { value: 4, label: "4" }], visibleWhen: (v) => v.keys },
    { key: "shortcuts", label: "Kısayollar menüsü", default: true, visibleWhen: (v) => v.message },
    { key: "copy", label: "Kopyala düğmesi", default: true, visibleWhen: (v) => v.message },
    { key: "flash", label: "Değişen yer parlar", default: true },
    { key: "multiline", label: "Enter yeni satır açar", default: true },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
    { key: "state", label: "Durum", default: "normal", options: [{ value: "normal", label: "normal" }, { value: "readonly", label: "salt okunur" }, { value: "disabled", label: "devre dışı" }] },
  ],
});
