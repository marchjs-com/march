import { definePlayground } from "../../meta.ts";

interface Values { kind: string; size: string; broken: boolean }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Tür", default: "image", kind: "cards", options: [{ value: "image", label: "resim" }, { value: "video", label: "video" }] },
    { key: "size", label: "Boyut", default: "md", kind: "segmented", options: [{ value: "sm", label: "küçük resim" }, { value: "md", label: "orta" }, { value: "full", label: "tam" }] },
    { key: "broken", label: "Bozuk adres (yedek metin)", default: false },
  ],
});
