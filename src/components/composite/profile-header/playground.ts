import { definePlayground } from "../../meta.ts";

interface Values { self: boolean; cover: string; story: string; photo: boolean }

export default definePlayground<Values>({
  options: [
    { key: "self", label: "Kendi profilim", default: false },
    { key: "cover", label: "Kapak", default: "md", options: [{ value: "none", label: "yok" }, { value: "sm", label: "kısa" }, { value: "md", label: "orta" }, { value: "lg", label: "uzun" }] },
    { key: "photo", label: "Kapak fotoğrafı", default: true, visibleWhen: (v) => v.cover !== "none" },
    { key: "story", label: "Hikâye halkası", default: "new", options: [{ value: "new", label: "yeni" }, { value: "seen", label: "görüldü" }, { value: "none", label: "yok" }] },
  ],
});
