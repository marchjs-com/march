import { definePlayground } from "../../meta.ts";

interface Values { newsletter: boolean; wordmark: boolean; social: boolean; toTop: boolean; copyright: boolean }

export default definePlayground<Values>({
  options: [
    { key: "newsletter", label: "Bülten formu", default: true },
    { key: "social", label: "Sosyal bağlantılar", default: true },
    { key: "wordmark", label: "Büyük yazı", default: true },
    { key: "copyright", label: "Telif satırı", default: true },
    { key: "toTop", label: "Başa dön düğmesi", default: true },
  ],
});
