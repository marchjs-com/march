import { definePlayground } from "../../meta.ts";

interface Values { mode: string; shrink: boolean; hide: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Görünüm", default: "floating", options: [{ value: "solid", label: "dolu" }, { value: "transparent", label: "saydam → cam" }, { value: "floating", label: "yüzen hap" }] },
    { key: "shrink", label: "Kaydırınca küçül", default: true },
    { key: "hide", label: "Aşağı kaydırırken gizlen", default: false },
  ],
});
