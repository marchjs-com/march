import { definePlayground } from "../../meta.ts";

export default definePlayground<{ multiple: boolean; accept: string; upload: boolean }>({
  options: [
    { key: "multiple", label: "Birden çok dosya", default: true },
    { key: "accept", label: "Kabul edilen", default: "image/*", options: [{ value: "", label: "her tür" }, { value: "image/*", label: "görsel" }, { value: ".pdf", label: "PDF" }] },
    { key: "upload", label: "Yükleme ilerlemesi", default: true },
  ],
});
