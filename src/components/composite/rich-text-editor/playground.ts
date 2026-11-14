import { definePlayground } from "../../meta.ts";

interface Values { toolbar: string; mentions: boolean; emoji: boolean; counter: boolean; readonly: boolean; rows: number; output: boolean; hint: boolean; ownIcons: boolean; ownLabels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "toolbar", label: "Araç çubuğu", default: "full", kind: "segmented", options: [{ value: "full", label: "tam" }, { value: "minimal", label: "sade" }, { value: "none", label: "yok" }] },
    { key: "mentions", label: "@ bahsetme", default: true },
    { key: "emoji", label: ": emoji", default: true },
    { key: "counter", label: "Sayaç", default: true },
    { key: "hint", label: "Alt ipucu (@ ve :)", default: true, visibleWhen: (v) => v.counter && (v.mentions || v.emoji) },
    { key: "ownIcons", label: "Kendi ikonlarım (B, I, U)", default: false, visibleWhen: (v) => v.toolbar !== "none" },
    { key: "ownLabels", label: "Kendi sayaç metnim", default: false, visibleWhen: (v) => v.counter },
    { key: "readonly", label: "Salt okunur", default: false },
    { key: "rows", label: "Yükseklik (satır)", default: 7, min: 3, max: 14, step: 1 },
    { key: "output", label: "Markdown çıktısı", default: true },
  ],
});
