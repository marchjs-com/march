import { definePlayground } from "../../meta.ts";

interface Values { orientation: string; follow: boolean; labels: boolean; value: number }

export default definePlayground<Values>({
  options: [
    { key: "orientation", label: "Yön", default: "horizontal", options: [{ value: "horizontal", label: "yatay" }, { value: "vertical", label: "dikey" }] },
    { key: "follow", label: "İmleci izle", default: false },
    { key: "labels", label: "Etiketler", default: true },
    { key: "value", label: "Konum", default: 50, min: 0, max: 100, step: 1 },
  ],
});
