import { definePlayground } from "../../meta.ts";

interface Values { orientation: string; badges: boolean; collapsible: boolean }

export default definePlayground<Values>({
  options: [
    { key: "orientation", label: "Yön", default: "vertical", options: [{ value: "vertical", label: "dikey" }, { value: "horizontal", label: "yatay" }] },
    { key: "badges", label: "Rozetler", default: true },
    { key: "collapsible", label: "Etkin görünüme yeniden basınca kapat", default: true },
  ],
});
