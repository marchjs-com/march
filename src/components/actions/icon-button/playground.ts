import { definePlayground } from "../../meta.ts";

interface Values { size: string; variant: string; shape: string; pressed: boolean; inverse: boolean; color: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["xs", "sm", "md", "lg"] },
    { key: "variant", label: "Varyant", default: "", options: [{ value: "", label: "düz" }, { value: "danger", label: "tehlike tonu" }, { value: "solid", label: "dolu" }, { value: "raised", label: "yükseltilmiş" }] },
    { key: "shape", label: "Biçim", default: "", options: [{ value: "", label: "köşeli" }, { value: "round", label: "yuvarlak" }] },
    { key: "pressed", label: "Basılı (aç/kapa)", default: false },
    { key: "inverse", label: "Koyu zemin üstünde", default: false },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
