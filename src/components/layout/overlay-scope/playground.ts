import { definePlayground } from "../../meta.ts";

interface Values { target: string }

export default definePlayground<Values>({
  options: [
    { key: "target", label: "Çekmece nerede açılsın", default: "nearest", options: [{ value: "nearest", label: "bu kutuda" }, { value: "page", label: "sayfada" }] },
  ],
});
