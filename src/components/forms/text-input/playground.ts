import { definePlayground } from "../../meta.ts";

export default definePlayground<{ kind: string; prefix: string; disabled: boolean }>({
  options: [
    { key: "kind", label: "Tür", default: "text", options: [{ value: "text", label: "metin" }, { value: "email", label: "e-posta" }, { value: "url", label: "web adresi" }] },
    { key: "prefix", label: "Ön ek", default: "icon", options: [{ value: "none", label: "yok" }, { value: "icon", label: "ikon" }, { value: "text", label: "metin" }] },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
