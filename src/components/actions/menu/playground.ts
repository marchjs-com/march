import { definePlayground } from "../../meta.ts";

interface Values { kind: string; trigger: string }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Tür", default: "menu", options: [{ value: "menu", label: "Menu" }, { value: "dropdown", label: "Dropdown" }] },
    { key: "trigger", label: "Tetik", default: "label", options: [{ value: "label", label: "metin" }, { value: "icon", label: "ikon" }] },
  ],
});
