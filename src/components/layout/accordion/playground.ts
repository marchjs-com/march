import { definePlayground } from "../../meta.ts";

interface Values { multiple: boolean; variant: string; icons: boolean }

export default definePlayground<Values>({
  options: [
    { key: "multiple", label: "Birden çok açık", default: false },
    { key: "variant", label: "Görünüm", default: "separated", options: [{ value: "separated", label: "ayrık" }, { value: "contained", label: "çerçeveli" }] },
    { key: "icons", label: "İkonlar", default: true },
  ],
});
