import { definePlayground } from "../../meta.ts";

interface Values { open: boolean; direction: string; size: string; motion: string; icon: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Açık", default: false },
    { key: "direction", label: "Kapalıyken yön", default: "end", options: [{ value: "end", label: "satır sonu" }, { value: "start", label: "satır başı" }, { value: "down", label: "aşağı" }, { value: "up", label: "yukarı" }] },
    { key: "size", label: "Boyut", default: "md", options: ["xs", "sm", "md", "lg"] },
    { key: "motion", label: "Dönüş", default: "smooth", options: [{ value: "smooth", label: "yumuşak" }, { value: "spring", label: "yaylı" }, { value: "off", label: "yok" }] },
    { key: "icon", label: "İkon", default: "default", options: [{ value: "default", label: "hazır ok" }, { value: "arrow", label: "kendi ikonum" }, { value: "text", label: "metin (›)" }] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "metin rengi" }, { value: "primary", label: "vurgu" }, { value: "brand-orange", label: "turuncu" }, { value: "danger", label: "tehlike" }] },
  ],
});
