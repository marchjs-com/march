import { definePlayground } from "../../meta.ts";

interface Values { mode: string; schema: boolean; readonly: boolean; switcher: boolean; format: boolean; status: boolean; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "İlk görünüm", default: "tree", kind: "segmented", options: [{ value: "tree", label: "ağaç" }, { value: "text", label: "metin" }] },
    { key: "schema", label: "Şema doğrulaması", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
    { key: "switcher", label: "Görünüm sekmeleri", default: true },
    { key: "format", label: "Biçimlendir düğmesi (metin görünümü)", default: true, visibleWhen: (v) => !v.readonly },
    { key: "status", label: "\"Geçerli JSON\" satırı (metin görünümü)", default: true },
    { key: "labels", label: "Kendi metinlerim", default: false },
  ],
});
