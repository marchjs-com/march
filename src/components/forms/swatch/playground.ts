import { definePlayground } from "../../meta.ts";

interface Values { palette: string; size: string; shape: string; mark: string; checker: boolean; clickable: boolean }

export default definePlayground<Values>({
  options: [
    { key: "palette", label: "Renkler", default: "solid", options: [{ value: "solid", label: "düz renkler" }, { value: "gradient", label: "gradyanlar" }, { value: "alpha", label: "saydam renkler" }, { value: "token", label: "tema belirteçleri" }] },
    { key: "size", label: "Boyut", default: "md", options: ["xs", "sm", "md", "lg"] },
    { key: "shape", label: "Biçim", default: "round", options: [{ value: "round", label: "yuvarlak köşe" }, { value: "square", label: "kare" }, { value: "circle", label: "daire" }] },
    { key: "mark", label: "Seçili işareti", default: "ring", options: [{ value: "ring", label: "yalnız halka" }, { value: "check", label: "tik" }, { value: "own", label: "kendi işaretim" }] },
    { key: "checker", label: "Dama zemini", default: true, visibleWhen: (v) => v.palette === "alpha" },
    { key: "clickable", label: "Tıklanabilir (düğme)", default: true },
  ],
});
