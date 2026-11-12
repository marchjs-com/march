// type-only import: the spec is plain data (its page imports it without the shared component chunk)
import type { PlaygroundSpec } from "../../meta.ts";

interface Values { timeline: boolean; fail: boolean }

const spec: PlaygroundSpec<Values> = {
  options: [
    { key: "timeline", label: "Zaman çizelgesi", default: true },
    { key: "fail", label: "Ödeme hata versin", default: false },
  ],
};
export default spec;
