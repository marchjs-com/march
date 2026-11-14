import { definePlayground } from "../../meta.ts";

interface Values { title: boolean; retry: boolean; retryLabel: string }

export default definePlayground<Values>({
  options: [
    { key: "title", label: "Başlık", default: true },
    { key: "retry", label: "Yeniden dene düğmesi", default: true },
    { key: "retryLabel", label: "Düğme metni", default: "default", kind: "segmented", options: [{ value: "default", label: "hazır metin" }, { value: "own", label: "Tekrar bağlan" }], visibleWhen: (v) => v.retry },
  ],
});
