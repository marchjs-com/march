import { definePlayground } from "../../meta.ts";

interface Values { layout: string; search: boolean; multiple: boolean }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Düzen", default: "split", options: [{ value: "center", label: "ortada" }, { value: "split", label: "iki sütun" }] },
    { key: "search", label: "Arama", default: true },
    { key: "multiple", label: "Birden çok açık", default: false },
  ],
});
