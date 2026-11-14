import { definePlayground } from "../../meta.ts";

interface Values { kind: string; action: boolean; timeout: number; icon: string; closable: boolean; motion: string }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Tür", default: "success", kind: "cards", options: [{ value: "info", label: "bilgi" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }] },
    { key: "action", label: "Geri al eylemi", default: true },
    { key: "icon", label: "İkon", default: "kind", options: [{ value: "kind", label: "türün ikonu" }, { value: "own", label: "kendi ikonum (mor yıldız)" }, { value: "emoji", label: "emoji" }, { value: "off", label: "yok" }] },
    { key: "closable", label: "Kapat (×) düğmesi", default: true },
    { key: "motion", label: "Giriş hareketi", default: "spring", options: [{ value: "spring", label: "yaylanarak" }, { value: "fade", label: "belirerek" }, { value: "none", label: "yok" }] },
    { key: "timeout", label: "Süre", default: 4000, kind: "segmented", options: [{ value: 2000, label: "2 sn" }, { value: 4000, label: "4 sn" }, { value: 8000, label: "8 sn" }, { value: 0, label: "kalıcı" }] },
  ],
});
