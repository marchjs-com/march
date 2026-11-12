import { definePlayground } from "../../meta.ts";

interface Values { header: boolean; nav: boolean; aside: boolean; footer: boolean }

export default definePlayground<Values>({
  options: [
    { key: "header", label: "Üst bilgi", default: true },
    { key: "nav", label: "Gezinme", default: true },
    { key: "aside", label: "Yan alan", default: false },
    { key: "footer", label: "Alt bilgi", default: true },
  ],
});
