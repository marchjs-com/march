// CommandManager: registry, async + cancellable run with busy state, concurrency, can/when, shortcut conflicts,
// history hook, palette adapter, menu items, command: props, CommandButton, key binding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h, render, signal, effect } = await import("../../index.ts");
const { setAccess } = await import("../../access/index.ts");
const { commands: paletteCommands } = await import("../../ui/registry.ts");
const { command, commands, onCommandRun, disposeCommands, configureCommands, normalizeShortcut } = await import("./index.ts");
const { commandItems, CommandButton, bindCommandKeys } = await import("./ui.ts");
const { onManager } = await import("../manager.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; };

test("register, list, run by id; the same id replaces the older command; dispose removes it", async () => {
  disposeCommands();
  const a = command({ id: "a", title: "A", run: (_ctx, x) => x * 2 });
  assert.equal(await a.run(21), 42);
  assert.equal(await commands.run("a", 5), 10);
  command({ id: "a", title: "A2", run: () => "new" });
  assert.equal(commands.list().length, 1);
  assert.equal(commands.get("a").title(), "A2");
  await assert.rejects(commands.run("missing"), /no command/);
  commands.get("a").dispose();
  assert.equal(commands.list().length, 0);
});

test("async run: busy while running, cancel aborts the signal, concurrency ignore / restart / parallel", async () => {
  disposeCommands();
  const d = deferred();
  let aborted = null;
  const save = command({ id: "save", title: "Save", run: async ({ signal }) => { signal.addEventListener("abort", () => { aborted = true; }); await d.p; return "ok"; } });
  const states = [];
  const stop = effect(() => states.push(save.busy()));
  const p1 = save.run();
  assert.equal(save.busy(), true);
  assert.equal(save.enabled(), false, "busy → not enabled");
  assert.equal(await save.run(), undefined, "ignore: a second run is skipped");
  save.cancel();
  d.resolve();
  assert.equal(await p1, undefined, "cancelled → undefined");
  assert.equal(aborted, true);
  assert.equal(save.busy(), false);
  assert.deepEqual(states, [false, true, false]);
  stop();

  let n = 0;
  const gates = [deferred(), deferred()];
  const search = command({ id: "search", title: "Search", concurrency: "restart", run: async ({ signal }) => { const i = n++; await gates[i].p; if (signal.aborted) throw Object.assign(new Error("x"), { name: "AbortError" }); return i; } });
  const s1 = search.run(), s2 = search.run();
  gates[0].resolve(); gates[1].resolve();
  assert.deepEqual(await Promise.all([s1, s2]), [undefined, 1], "restart: the first is cancelled");

  const both = command({ id: "both", title: "Both", concurrency: "parallel", run: async (_c, x) => { await tick(1); return x; } });
  assert.deepEqual(await Promise.all([both.run(1), both.run(2)]), [1, 2]);
});

test("errors reject and are reported; history hook gets successful runs; events", async () => {
  disposeCommands();
  const events = [];
  const prev = onManager("*", (e) => events.push(`${e.manager}:${e.type}`));
  const runs = [];
  const off = onCommandRun((r) => runs.push([r.id, r.args, r.result]));
  const boom = command({ id: "boom", title: "Boom", run: () => { throw new Error("nope"); } });
  const ok = command({ id: "ok", title: "Ok", run: (_c, x) => x + 1 });
  await assert.rejects(boom.run(), /nope/);
  await ok.run(1);
  assert.deepEqual(runs, [["ok", [1], 2]]);
  assert.ok(["command:register", "command:run", "command:error", "command:done"].every((e) => events.includes(e)));
  off(); prev();
});

test("can: hidden and never runs without permission; when: shown but disabled", async () => {
  disposeCommands();
  setAccess({ user: { id: 1 }, perms: [] });
  const $dirty = signal(false);
  let ran = 0;
  const del = command({ id: "del", title: "Delete", can: "docs.delete", run: () => { ran++; } });
  const save = command({ id: "save", title: "Save", when: () => $dirty(), run: () => { ran++; } });
  assert.equal(del.visible(), false);
  assert.equal(await del.run(), undefined);
  assert.equal(save.visible(), true);
  assert.equal(save.enabled(), false);
  await save.run();
  assert.equal(ran, 0);
  $dirty.set(true);
  setAccess({ user: { id: 1 }, perms: ["docs.delete"] });
  assert.ok(del.visible() && save.enabled());
  await del.run(); await save.run();
  assert.equal(ran, 2);
  setAccess(null);
});

test("shortcut conflicts are found at registration (normalized: mod+S = ctrl+s off macOS)", () => {
  disposeCommands();
  assert.equal(normalizeShortcut("Mod+Shift+K"), "ctrl+shift+k");
  command({ id: "x", title: "X", shortcut: "mod+s", run() {} });
  command({ id: "y", title: "Y", shortcut: "ctrl+S", run() {} });
  command({ id: "z", title: "Z", shortcut: "mod+k", run() {} });
  assert.deepEqual(commands.conflicts(), [{ shortcut: "ctrl+s", ids: ["x", "y"] }]);
  commands.get("y").dispose();
  assert.deepEqual(commands.conflicts(), []);
});

test("palette adapter: commands show in the palette registry; hidden when not permitted or unavailable; opt-out", async () => {
  disposeCommands();
  setAccess({ user: { id: 1 }, perms: [] });
  const $ok = signal(true);
  command({ id: "p.one", title: "One", group: "G", shortcut: "mod+1", when: () => $ok(), run: () => 1 });
  command({ id: "p.two", title: "Two", can: "x", run: () => 2 });
  command({ id: "p.three", title: "Three", palette: false, run: () => 3 });
  const mine = () => paletteCommands().filter((c) => String(c.id).startsWith("p."));
  assert.deepEqual(mine().map((c) => c.id), ["p.one", "p.two"]);
  const one = mine()[0];
  assert.equal(one.title(), "One");
  assert.equal(one.group, "G");
  assert.equal(one.shortcut, "mod+1");
  assert.equal(one.hidden(), false);
  $ok.set(false);
  assert.equal(one.hidden(), true, "unavailable → not offered");
  assert.equal(mine()[1].can, "x", "the palette applies can()");
  configureCommands({ palette: false });
  command({ id: "p.four", title: "Four", run() {} });
  assert.equal(mine().length, 0, "palette: false");
  configureCommands({ palette: true });
  setAccess(null);
});

test("menu items, command: props and CommandButton show the same command and state", async () => {
  disposeCommands();
  const d = deferred();
  const $dirty = signal(true);
  let runs = 0;
  command({ id: "doc.save", title: "Save", group: "File", shortcut: "mod+s", when: () => $dirty(), run: async () => { runs++; await d.p; } });
  command({ id: "doc.close", title: "Close", group: "File", run: () => {} });
  command({ id: "doc.other", title: "Other", group: "Edit", run: () => {} });
  const items = commandItems({ group: "File" });
  assert.deepEqual(items().map((i) => i.label()), ["Save", "Close"]);
  assert.equal(items()[0].shortcut, "mod+s");
  assert.deepEqual(commandItems(["doc.other", "doc.save"])().map((i) => i.label()), ["Other", "Save"]);

  const host = document.createElement("div");
  const off = render(() => [h("button", { id: "plain", "command:doc.save": true }, "Save"), h(CommandButton, { command: "doc.save" })], host);
  const plain = host.querySelector("#plain");
  const btn = host.querySelector(".hm-btn");
  assert.equal(plain.disabled, false);
  assert.equal(plain.getAttribute("aria-keyshortcuts"), "Control+S");
  assert.match(btn.textContent, /Save/);
  plain.click();
  await tick();
  assert.equal(runs, 1);
  assert.equal(plain.getAttribute("aria-busy"), "true", "busy shows on every place");
  assert.equal(btn.disabled, true);
  assert.equal(items()[0].disabled(), true);
  d.resolve(); await tick();
  assert.equal(plain.hasAttribute("aria-busy"), false);
  $dirty.set(false);
  assert.equal(plain.disabled, true, "when → disabled");
  assert.throws(() => render(() => h("button", { "command:nope": true }), document.createElement("div")), /no such command/);
  off();
});

test("bindCommandKeys(): shortcuts run commands; unbind stops them", async () => {
  disposeCommands();
  let n = 0;
  command({ id: "k", title: "K", shortcut: "ctrl+j", run: () => { n++; } });
  const unbind = bindCommandKeys();
  const press = () => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: "j", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }); document.dispatchEvent(e); };
  press(); await tick();
  assert.equal(n, 1);
  command({ id: "k2", title: "K2", shortcut: "ctrl+j", run: () => { n += 10; } });
  unbind();
  press(); await tick();
  assert.equal(n, 1, "unbound");
});
