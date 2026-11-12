import { definePlayground } from "../../meta.ts";

interface Values { open: number }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Açık derinlik", default: 1, options: [0, 1, 2, 3] },
  ],
});
