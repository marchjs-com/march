import { definePlayground } from "../../meta.ts";

interface Values { size: string; danger: boolean; color: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    { key: "danger", label: "Tehlike tonu", default: false },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
