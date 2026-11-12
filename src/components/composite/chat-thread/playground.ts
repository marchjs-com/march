import { definePlayground } from "../../meta.ts";

interface Values { group: boolean; replyDelay: number }

export default definePlayground<Values>({
  options: [
    { key: "group", label: "Grup sohbeti", default: true },
    { key: "replyDelay", label: "Karşı taraf yanıtı", default: 1800, options: [{ value: 900, label: "hızlı" }, { value: 1800, label: "orta" }, { value: 0, label: "yanıt yok" }] },
  ],
});
