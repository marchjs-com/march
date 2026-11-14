import { definePlayground } from "../../meta.ts";

interface Values { view: string; toolbar: boolean; sync: boolean; stats: boolean; rich: boolean; readonly: boolean; tools: string; hint: boolean; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "view", label: "İlk görünüm", default: "split", kind: "segmented", options: [{ value: "write", label: "yaz" }, { value: "preview", label: "önizle" }, { value: "split", label: "böl" }, { value: "rich", label: "zengin" }] },
    { key: "toolbar", label: "Araç çubuğu", default: true, visibleWhen: (v) => v.view === "write" || v.view === "split" },
    { key: "tools", label: "Araçlar", default: "all", kind: "segmented", options: [{ value: "all", label: "tümü" }, { value: "short", label: "kalın, italik, bağlantı, liste" }], visibleWhen: (v) => v.toolbar && (v.view === "write" || v.view === "split") },
    { key: "sync", label: "Eşzamanlı kaydırma", default: true, visibleWhen: (v) => v.view === "split" },
    { key: "stats", label: "Kelime ve okuma süresi", default: true },
    { key: "hint", label: "Sözdizimi hatırlatması", default: true, visibleWhen: (v) => v.stats && v.view !== "rich" },
    { key: "labels", label: "Kendi metinlerim (sekmeler, sayaç)", default: false },
    { key: "rich", label: "Zengin görünüm sekmesi", default: true, visibleWhen: (v) => v.view !== "rich" },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
