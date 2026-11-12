import { definePlayground } from "../../meta.ts";

interface Values { kind: string; action: boolean; timeout: number }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Tür", default: "success", kind: "cards", options: [{ value: "info", label: "bilgi" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }] },
    { key: "action", label: "Geri al eylemi", default: true },
    { key: "timeout", label: "Süre", default: 4000, kind: "segmented", options: [{ value: 2000, label: "2 sn" }, { value: 4000, label: "4 sn" }, { value: 8000, label: "8 sn" }, { value: 0, label: "kalıcı" }] },
  ],
});
