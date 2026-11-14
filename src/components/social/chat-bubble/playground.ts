import { definePlayground } from "../../meta.ts";

interface Values { mine: boolean; status: string; reply: boolean; reactions: boolean; group: boolean; color: string; ticks: string; tools: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mine", label: "Benim mesajım", default: true },
    { key: "status", label: "Durum", default: "read", options: [{ value: "sending", label: "gidiyor" }, { value: "sent", label: "gönderildi" }, { value: "delivered", label: "iletildi" }, { value: "read", label: "okundu" }, { value: "failed", label: "gitmedi" }], visibleWhen: (v) => v.mine },
    { key: "color", label: "Balon rengi", default: "brand-blue", options: [{ value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }, { value: "brand-green", label: "yeşil" }, { value: "brand-orange", label: "turuncu" }], visibleWhen: (v) => v.mine, prop: "m:color" },
    { key: "ticks", label: "İletim işareti", default: "on", options: [{ value: "on", label: "tikler" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.mine },
    { key: "group", label: "Grup (gönderen adı)", default: true, visibleWhen: (v) => !v.mine },
    { key: "reply", label: "Yanıt alıntısı", default: true },
    { key: "reactions", label: "Tepkiler", default: true },
    { key: "tools", label: "Yanıtla düğmesi (üzerine gelince)", default: true },
  ],
});
