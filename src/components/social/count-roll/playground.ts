import { definePlayground } from "../../meta.ts";

interface Values { format: string; step: number }

export default definePlayground<Values>({
  options: [
    { key: "format", label: "Biçim", default: "compact", options: [{ value: "compact", label: "kısa (1,2 B)" }, { value: "full", label: "tam (1.234)" }] },
    { key: "step", label: "Adım", default: 1, options: [{ value: 1, label: "+1" }, { value: 9, label: "+9" }, { value: 250, label: "+250" }] },
  ],
});
