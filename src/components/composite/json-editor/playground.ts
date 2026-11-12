import { definePlayground } from "../../meta.ts";

interface Values { mode: string; schema: boolean; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "İlk görünüm", default: "tree", kind: "segmented", options: [{ value: "tree", label: "ağaç" }, { value: "text", label: "metin" }] },
    { key: "schema", label: "Şema doğrulaması", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
