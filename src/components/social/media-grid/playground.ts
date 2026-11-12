import { definePlayground } from "../../meta.ts";

interface Values { count: number; shape: string; gap: string; max: number }

export default definePlayground<Values>({
  options: [
    { key: "count", label: "Fotoğraf", default: 3, options: [1, 2, 3, 4, 6].map((n) => ({ value: n, label: String(n) })) },
    { key: "shape", label: "Biçim", default: "auto", options: [{ value: "auto", label: "kendi oranı" }, { value: "square", label: "kare" }, { value: "portrait", label: "dikey 4:5" }], visibleWhen: (v) => v.count !== 3 && v.count < 4 },
    { key: "gap", label: "Ara", default: "thin", options: [{ value: "none", label: "yok" }, { value: "thin", label: "ince" }, { value: "gap", label: "boşluklu" }], visibleWhen: (v) => v.count > 1 },
    { key: "max", label: "En çok", default: 4, options: [2, 3, 4], visibleWhen: (v) => v.count > 2 },
  ],
});
