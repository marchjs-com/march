import { definePlayground } from "../../meta.ts";

interface Values { title: boolean; retry: boolean }

export default definePlayground<Values>({
  options: [
    { key: "title", label: "Başlık", default: true },
    { key: "retry", label: "Yeniden dene düğmesi", default: true },
  ],
});
