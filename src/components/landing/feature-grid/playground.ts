import { definePlayground } from "../../meta.ts";

interface Values { variant: string; cols: number; spotlight: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "bento", options: [{ value: "cards", label: "kartlar" }, { value: "plain", label: "sade" }, { value: "list", label: "liste" }, { value: "bento", label: "bento" }] },
    { key: "cols", label: "Sütun", default: 3, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }], visibleWhen: (v) => v.variant === "cards" || v.variant === "plain" },
    { key: "spotlight", label: "İmleç ışığı", default: true, visibleWhen: (v) => v.variant === "cards" || v.variant === "bento" },
  ],
});
