import { definePlayground } from "../../meta.ts";

interface Values { chrome: string; snap: boolean; resizable: boolean }

export default definePlayground<Values>({
  options: [
    { key: "chrome", label: "Görünüm", default: "hadi", options: [{ value: "hadi", label: "HADİ" }, { value: "mac", label: "Mac" }, { value: "windows", label: "Windows" }] },
    { key: "snap", label: "Kenara kenetlen", default: true },
    { key: "resizable", label: "Boyutlanabilir", default: true },
  ],
});
