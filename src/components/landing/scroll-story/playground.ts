import { definePlayground } from "../../meta.ts";

interface Values { side: string; theme: boolean }

export default definePlayground<Values>({
  options: [
    { key: "side", label: "Görsel tarafı", default: "end", options: [{ value: "start", label: "baş" }, { value: "end", label: "son" }] },
    { key: "theme", label: "Adıma göre renk", default: true },
  ],
});
