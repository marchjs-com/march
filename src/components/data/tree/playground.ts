import { definePlayground } from "../../meta.ts";

interface Values { open: string; icons: boolean; meta: boolean }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Başlangıçta açık", default: "some", options: [{ value: "none", label: "kapalı" }, { value: "some", label: "src/ui" }, { value: "all", label: "tümü" }] },
    { key: "icons", label: "İkon", default: true },
    { key: "meta", label: "Sağdaki bilgi", default: true },
  ],
});
