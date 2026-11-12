import { definePlayground } from "../../meta.ts";

interface Values { count: number; duration: number; paused: boolean }

export default definePlayground<Values>({
  options: [
    { key: "count", label: "Hikâye", default: 5, options: [1, 3, 5, 10] },
    { key: "duration", label: "Süre", default: 3000, options: [{ value: 1500, label: "1,5 sn" }, { value: 3000, label: "3 sn" }, { value: 6000, label: "6 sn" }] },
    { key: "paused", label: "Duraklat", default: false },
  ],
});
