// Type tests: generator components. `function*` / `async function*` are components (the compiler wraps capitalised
// declarations); their static options are typed through GeneratorOptions; generator() keeps the props type.
/// <reference path="../types/jsx.d.ts" />
import { generator, type GeneratorOptions } from "march";

function* List(props: { n: number }) { for (let i = 0; i < props.n; i++) yield <li>{i}</li>; }
List.chunk = 20;
async function* Clock() { while (true) { yield <b>{Date.now()}</b>; await new Promise((r) => setTimeout(r, 1000)); } }
Clock.yields = "replace" satisfies GeneratorOptions["yields"];

const Steps = generator(function* (props: { label: string }) { yield props.label; }, { yields: "replace" });
const chunk: number | undefined = Steps.chunk;

export const ok = [<List n={3} />, <Clock />, <Steps label="x" />, chunk];
// @ts-expect-error props stay typed
export const bad = <List n="3" />;
// @ts-expect-error only "append" | "replace"
generator(function* () { yield 1; }, { yields: "prepend" });
