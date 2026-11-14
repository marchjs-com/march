import { definePlayground } from "../../meta.ts";

interface Values { group: boolean; replyDelay: number; days: string; motion: boolean }

export default definePlayground<Values>({
  options: [
    { key: "group", label: "Grup sohbeti", default: true },
    { key: "replyDelay", label: "Karşı taraf yanıtı", default: 1800, options: [{ value: 900, label: "hızlı" }, { value: 1800, label: "orta" }, { value: 0, label: "yanıt yok" }] },
    { key: "days", label: "Gün ayraçları", default: "on", options: [{ value: "on", label: "Bugün / Dün / tarih" }, { value: "own", label: "kendi biçimim (gün adı)" }, { value: "off", label: "yok" }] },
    { key: "motion", label: "Mesaj giriş hareketi", default: true },
  ],
});
