import { definePlayground } from "../../meta.ts";

interface Values { width: number; siblings: boolean; separator: string; collapse: boolean }

export default definePlayground<Values>({
  options: [
    { key: "width", label: "Genişlik", default: 360, min: 200, max: 760, step: 20, unit: "px" },
    { key: "siblings", label: "Kardeş menüleri", default: true },
    { key: "separator", label: "Ayraç", default: "chevron", options: [{ value: "chevron", label: "ok" }, { value: "slash", label: "/" }, { value: "dot", label: "•" }, { value: "icon", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "collapse", label: "Sığmayınca ortayı topla (…)", default: true },
  ],
});
