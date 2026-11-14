import { definePlayground } from "../../meta.ts";

interface Values { summary: boolean; caption: boolean }

export default definePlayground<Values>({
  options: [
    { key: "summary", label: "Özet ve süzgeç", default: true },
    { key: "caption", label: "Başlığı göster", default: false },
  ],
});
