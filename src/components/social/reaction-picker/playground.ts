import { definePlayground } from "../../meta.ts";

interface Values { layout: string; more: boolean }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Düzen", default: "row", options: [{ value: "row", label: "satır (tepki)" }, { value: "grid", label: "ızgara (emoji paneli)" }] },
    { key: "more", label: "+ düğmesi", default: true, visibleWhen: (v) => v.layout === "row" },
  ],
});
