import { definePlayground } from "../../meta.ts";

interface Values { gallery: boolean; next: boolean }

export default definePlayground<Values>({
  options: [
    { key: "gallery", label: "Galeri", default: true },
    { key: "next", label: "Sonraki proje", default: true },
  ],
});
