import { definePlayground } from "../../meta.ts";

interface Values { mine: boolean; status: string; reply: boolean; reactions: boolean; group: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mine", label: "Benim mesajım", default: true },
    { key: "status", label: "Durum", default: "read", options: [{ value: "sending", label: "gidiyor" }, { value: "sent", label: "gönderildi" }, { value: "delivered", label: "iletildi" }, { value: "read", label: "okundu" }, { value: "failed", label: "gitmedi" }], visibleWhen: (v) => v.mine },
    { key: "group", label: "Grup (gönderen adı)", default: true, visibleWhen: (v) => !v.mine },
    { key: "reply", label: "Yanıt alıntısı", default: true },
    { key: "reactions", label: "Tepkiler", default: true },
  ],
});
