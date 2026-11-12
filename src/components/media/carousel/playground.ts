import { definePlayground } from "../../meta.ts";

interface Values { perView: number; slides: number }

export default definePlayground<Values>({
  options: [
    { key: "perView", label: "Görünen", default: 2, kind: "segmented", options: [1, 2, 3, 4] },
    { key: "slides", label: "Slayt sayısı", default: 6, min: 3, max: 10, step: 1 },
  ],
});
