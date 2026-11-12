import { definePlayground } from "../../meta.ts";

interface Values { attached: boolean }

export default definePlayground<Values>({
  options: [
    { key: "attached", label: "Bitişik", default: true },
  ],
});
