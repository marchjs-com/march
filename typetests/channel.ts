// Type tests (tsc --noEmit): channel names and payloads are checked; wrong ones must fail.
import { channel, defineChannels, of, useChannel, type Channel, type ChannelPattern } from "../src/channel/index.ts";

const ch = defineChannels({
  "cart.changed": of<{ count: number }>({ sticky: true }),
  "cart.cleared": of(),
  "chart.select": of<{ month: string } | null>({ sticky: true }),
});

ch["cart.changed"].emit({ count: 1 });
ch["cart.cleared"].emit();
ch["chart.select"].emit(null);
ch["cart.changed"].on((p, from) => { const n: number = p.count; const f: "local" | "tab" = from; void n; void f; });
const last: { count: number } | undefined = ch["cart.changed"].last();
const sig: () => { month: string } | null | undefined = ch["chart.select"].toSignal();
void last; void sig;
const p: Promise<{ count: number }> = ch["cart.changed"].once();
void p;

// @ts-expect-error — no such channel
ch["cart.chnaged"].emit({ count: 1 });
// @ts-expect-error — wrong payload type
ch["cart.changed"].emit({ count: "1" });
// @ts-expect-error — payload is required
ch["cart.changed"].emit();
// @ts-expect-error — listener expects the wrong payload
ch["cart.changed"].on((x: { total: number }) => void x);

// wildcard: the message is the union of the matching channels, narrowed by name
ch.on("cart.*", (m) => {
  if (m.name === "cart.changed") { const n: number = m.payload.count; void n; }
  else { const v: void = m.payload; const name: "cart.cleared" = m.name; void v; void name; }
});
ch.on("*", (m) => { const name: "cart.changed" | "cart.cleared" | "chart.select" = m.name; void name; });
ch.on("chart.select", (m) => { const sel: { month: string } | null = m.payload; void sel; });
// @ts-expect-error — no channel starts with "crt."
ch.on("crt.*", () => {});
// @ts-expect-error — "chart" alone is not a channel
ch.on("chart", () => {});
// @ts-expect-error — "cart.*" never carries a chart message
ch.on("cart.*", (m) => { if (m.name === "chart.select") void m; });

type Pat = ChannelPattern<"a.b.c" | "a.d">;
const ok1: Pat = "a.*", ok2: Pat = "a.b.*", ok3: Pat = "*";
// @ts-expect-error — not a pattern of these names
const bad: Pat = "b.*";
void ok1; void ok2; void ok3; void bad;

const one: Channel<{ id: string }> = channel<{ id: string }>("item.opened");
const bound: Channel<{ id: string }> = useChannel(one);
// @ts-expect-error — wrong payload
bound.emit({ id: 1 });
