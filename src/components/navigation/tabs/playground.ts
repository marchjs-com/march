import { definePlayground } from "../../meta.ts";

interface Values { badges: boolean; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "badges", label: "Sayı rozeti", default: true },
    { key: "disabled", label: "Faturalama sekmesi devre dışı", default: true },
  ],
});
