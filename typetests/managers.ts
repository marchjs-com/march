// Type tests (tsc --noEmit): ViewportManager, ConsentManager and CommandManager APIs.
import { viewport, configureViewport, type ContainerSize } from "../src/managers/viewport/index.ts";
import { consent, configureConsent, type ConsentRecord } from "../src/managers/consent/index.ts";
import { command, commands, onCommandRun, pickCommands, type Command } from "../src/managers/command/index.ts";
import { commandItems } from "../src/managers/command/ui.ts";
import { Menu } from "../src/ui/menu.ts";
import { h } from "../src/dom/h.ts";

// viewport: typed signals
const vp = viewport();
const mobile: boolean = vp.mobile();
const bp: string = vp.breakpoint();
const pointer: "coarse" | "fine" | "none" = vp.pointer();
const orientation: "portrait" | "landscape" = vp.orientation();
const inset: number = vp.safeArea().bottom;
const box: ContainerSize = vp.container(h("div", {}));
const boxWidth: number = box.width();
configureViewport({ breakpoints: { phone: 0, wide: 900 }, dark: () => true });
// @ts-expect-error — breakpoints are numbers
configureViewport({ breakpoints: { phone: "0" } });
void [mobile, bp, pointer, orientation, inset, boxWidth];

// consent: categories, records, gates keep the wrapped function's types
const granted: boolean = consent.has("analytics");
const custom: boolean = consent.has("maps");
const rec: ConsentRecord = consent.save({ analytics: true });
const send = consent.gate("analytics", (event: string, n: number) => event.length + n);
const sent: number | undefined = send("view", 1);
// @ts-expect-error — the gate keeps the argument types
send(1, 1);
const off: () => void = consent.whenGranted("thirdParty", () => () => {});
configureConsent({ version: "2026-11", maxAgeDays: 180, storage: null });
void [granted, custom, rec, sent, off];

// command: run() takes the spec's arguments and resolves to its result or undefined
interface Doc { id: number; title: string }
const save = command({ id: "doc.save", title: "Save", shortcut: "mod+s", run: async ({ signal }, doc: Doc) => { void signal; return doc.id; } });
const saved: Promise<number | undefined> = save.run({ id: 1, title: "x" });
// @ts-expect-error — run() needs a Doc
void save.run("nope");
const busy: boolean = save.busy();
const anyCmd: Command | undefined = commands.get("doc.save");
const stopHistory: () => void = onCommandRun((r) => { const id: string = r.id; void id; });
const fileCmds: Command[] = pickCommands({ group: "File" })();
h(Menu, { label: "File", items: commandItems({ group: "File" }) });
// @ts-expect-error — a command needs run()
command({ id: "x", title: "X" });
void [saved, busy, anyCmd, stopHistory, fileCmds];
