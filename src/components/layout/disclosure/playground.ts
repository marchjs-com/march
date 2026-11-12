import { definePlayground } from "../../meta.ts";

interface Values { open: boolean }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Açık başlar", default: true },
  ],
});
