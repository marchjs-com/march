import { definePlayground } from "../../meta.ts";

interface Values { eyebrow: string; lead: boolean; actions: boolean; note: boolean; align: string; size: string; level: string; color: string; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Ölçek", default: "md", options: [{ value: "sm", label: "sm (kart)" }, { value: "md", label: "md (bölüm)" }, { value: "lg", label: "lg (çağrı)" }, { value: "xl", label: "xl (hero)" }] },
    { key: "align", label: "Hizalama", default: "center", options: [{ value: "start", label: "başa" }, { value: "center", label: "ortaya" }, { value: "end", label: "sona" }] },
    { key: "eyebrow", label: "Üst etiket", default: "text", options: [{ value: "text", label: "metin" }, { value: "badge", label: "kendi rozetim" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Etiket rengi", default: "default", options: [{ value: "default", label: "aksan" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.eyebrow === "text", prop: "m:color" },
    { key: "lead", label: "Açıklama", default: true },
    { key: "actions", label: "Eylemler", default: true },
    { key: "note", label: "Not", default: true },
    { key: "level", label: "Başlık düzeyi", default: "h2", options: ["h1", "h2", "h3", "h4"] },
    { key: "reveal", label: "Giriş hareketi", default: "off", options: [{ value: "off", label: "yok" }, { value: "up", label: "yukarı" }, { value: "blur", label: "bulanıktan" }, { value: "scale", label: "büyüyerek" }] },
  ],
});
