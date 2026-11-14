import { definePlayground } from "../../meta.ts";

interface Values { orientation: string; follow: boolean; labels: boolean; grip: string; hint: boolean; value: number }

export default definePlayground<Values>({
  options: [
    { key: "orientation", label: "Yön", default: "horizontal", options: [{ value: "horizontal", label: "yatay" }, { value: "vertical", label: "dikey" }] },
    { key: "follow", label: "İmleci izle", default: false },
    { key: "labels", label: "Etiketler", default: true },
    { key: "grip", label: "Tutamaç", default: "arrows", options: [{ value: "arrows", label: "oklar" }, { value: "own", label: "kendi simgem" }, { value: "off", label: "yalnız çizgi" }] },
    { key: "hint", label: "İlk görünüşte salınım", default: true },
    { key: "value", label: "Konum", default: 50, min: 0, max: 100, step: 1 },
  ],
});
