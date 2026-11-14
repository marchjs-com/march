import { definePlayground } from "../../meta.ts";

interface Values { max: number; size: string; spacing: string; more: string; shape: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "max", label: "Gösterilen kişi", default: 4, min: 1, max: 8, step: 1 },
    { key: "size", label: "Boyut", default: "sm", options: ["xs", "sm", "md", "lg"] },
    { key: "spacing", label: "Aralık", default: "overlap", options: [{ value: "overlap", label: "üst üste" }, { value: "gap", label: "yan yana" }] },
    { key: "more", label: "+N balonu", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi içeriğim" }, { value: "off", label: "yok" }] },
    { key: "shape", label: "Biçim", default: "circle", options: [{ value: "circle", label: "daire" }, { value: "square", label: "kare" }] },
    { key: "color", label: "Renk", default: "name", options: [{ value: "name", label: "addan" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "neutral", label: "nötr" }] },
  ],
});
