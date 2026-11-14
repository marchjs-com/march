import { definePlayground } from "../../meta.ts";

export default definePlayground<{ presets: boolean; custom: boolean; separator: string }>({
  options: [
    { key: "presets", label: "Hazır aralıklar", default: true },
    { key: "custom", label: "“Özel” seçeneği", default: true, visibleWhen: (v) => v.presets },
    { key: "separator", label: "İki tarih arası işaret", default: "dash", options: [{ value: "dash", label: "–" }, { value: "arrow", label: "→" }, { value: "off", label: "yok" }], visibleWhen: (v) => !v.presets || v.custom },
  ],
});
