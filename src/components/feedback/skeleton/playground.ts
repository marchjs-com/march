import { definePlayground } from "../../meta.ts";

interface Values { mode: string; lines: number; height: string; colors: string; shimmer: boolean; shortLast: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Biçim", default: "card", kind: "cards", options: [{ value: "card", label: "kart" }, { value: "lines", label: "satırlar" }, { value: "block", label: "blok" }] },
    { key: "lines", label: "Satır", default: 3, min: 1, max: 6, step: 1, visibleWhen: (v) => v.mode !== "block" },
    { key: "height", label: "Blok yüksekliği", default: "md", kind: "segmented", options: ["sm", "md", "lg"], visibleWhen: (v) => v.mode !== "lines" },
    { key: "colors", label: "Parıltı", default: "theme", kind: "segmented", options: [{ value: "theme", label: "tema" }, { value: "brand", label: "marka" }, { value: "single", label: "tek renk" }] },
    { key: "shimmer", label: "Parıltı hareketi", default: true },
    { key: "shortLast", label: "Son satır kısa", default: true, visibleWhen: (v) => v.mode !== "block" },
  ],
});
