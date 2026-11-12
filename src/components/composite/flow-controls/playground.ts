// type-only import: the spec is plain data (its page imports it without the shared component chunk)
import type { PlaygroundSpec } from "../../meta.ts";

interface Values { timeline: boolean }

const spec: PlaygroundSpec<Values> = {
  options: [
    { key: "timeline", label: "Zaman çizelgesi", default: true },
  ],
};
export default spec;
