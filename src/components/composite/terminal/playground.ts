import { definePlayground } from "../../meta.ts";

interface Values { window: string; scheme: string; background: string; cursor: string; prompt: string }

export default definePlayground<Values>({
  options: [
    { key: "window", label: "Pencere", default: "none", options: [{ value: "none", label: "yok" }, { value: "hadi", label: "HADİ" }, { value: "mac", label: "Mac" }, { value: "windows", label: "Windows" }] },
    { key: "scheme", label: "Renk takımı", default: "auto", options: [{ value: "auto", label: "füme" }, { value: "surface", label: "sayfadan" }, { value: "dark", label: "koyu" }, { value: "light", label: "açık" }, { value: "hadi", label: "HADİ" }] },
    { key: "background", label: "Arka plan", default: "", options: [{ value: "", label: "takımdan" }, { value: "#0b1d33", label: "gece mavisi" }, { value: "#1f1330", label: "mor" }, { value: "#0f2a1d", label: "orman" }, { value: "#000000", label: "siyah" }, { value: "#f4ecd8", label: "kâğıt" }] },
    { key: "cursor", label: "İmleç", default: "bar", options: [{ value: "bar", label: "çizgi" }, { value: "block", label: "blok" }, { value: "underline", label: "alt çizgi" }] },
    { key: "prompt", label: "İstem", default: "hadi$ ", options: [{ value: "hadi$ ", label: "hadi$" }, { value: "❯ ", label: "❯" }, { value: "march › ", label: "march ›" }] },
  ],
});
