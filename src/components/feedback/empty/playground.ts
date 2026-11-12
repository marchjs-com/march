import { definePlayground } from "../../meta.ts";

interface Values { icon: boolean; text: boolean; action: boolean }

export default definePlayground<Values>({
  options: [
    { key: "icon", label: "İkon", default: true },
    { key: "text", label: "Açıklama", default: true },
    { key: "action", label: "Eylem düğmesi", default: true },
  ],
});
