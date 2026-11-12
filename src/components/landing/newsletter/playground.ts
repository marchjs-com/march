import { definePlayground } from "../../meta.ts";

interface Values { layout: string; outcome: string }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Düzen", default: "inline", options: [{ value: "inline", label: "tek satır" }, { value: "stacked", label: "alt alta" }] },
    { key: "outcome", label: "Sunucu yanıtı", default: "ok", options: [{ value: "ok", label: "başarılı" }, { value: "fail", label: "hata" }] },
  ],
});
