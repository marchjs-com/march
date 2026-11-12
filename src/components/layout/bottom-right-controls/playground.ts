import { definePlayground } from "../../meta.ts";

interface Values { corner: string }

export default definePlayground<Values>({
  options: [
    { key: "corner", label: "Köşe", default: "bottom-end", options: [{ value: "top-start", label: "üst baş" }, { value: "top-end", label: "üst son" }, { value: "bottom-start", label: "alt baş" }, { value: "bottom-end", label: "alt son" }] },
  ],
});
