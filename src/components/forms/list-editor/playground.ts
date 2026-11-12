import { definePlayground } from "../../meta.ts";

export default definePlayground<{ max: number; readonly: boolean }>({
  options: [
    { key: "max", label: "En fazla", default: 5, options: [3, 5, 10] },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
