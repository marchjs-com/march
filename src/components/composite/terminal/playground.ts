import { definePlayground } from "../../meta.ts";

interface Values { scheme: string; cursor: string; prompt: string }

export default definePlayground<Values>({
  options: [
    { key: "scheme", label: "Renk takımı", default: "auto", options: [{ value: "auto", label: "temadan" }, { value: "dark", label: "koyu" }, { value: "light", label: "açık" }, { value: "hadi", label: "HADİ" }] },
    { key: "cursor", label: "İmleç", default: "bar", options: [{ value: "bar", label: "çizgi" }, { value: "block", label: "blok" }, { value: "underline", label: "alt çizgi" }] },
    { key: "prompt", label: "İstem", default: "hadi$ ", options: [{ value: "hadi$ ", label: "hadi$" }, { value: "❯ ", label: "❯" }, { value: "march › ", label: "march ›" }] },
  ],
});
