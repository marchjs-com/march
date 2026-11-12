import { definePlayground } from "../../meta.ts";

interface Values { start: string; presets: boolean; output: boolean; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "start", label: "Başlangıç", default: "hadi", kind: "segmented", options: [{ value: "hadi", label: "HADİ" }, { value: "radial", label: "dairesel" }, { value: "conic", label: "konik" }] },
    { key: "presets", label: "Hazır gradyanlar", default: true },
    { key: "output", label: "CSS çıktısı", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
