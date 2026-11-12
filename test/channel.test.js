import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
installDom({ url: "http://localhost/" });
const { h, render, createRoot, signal, effect, If, catchError } = await import("../src/index.ts");
const C = await import("../src/channel/index.ts");
const { channel, defineChannels, of, useChannel, ChannelScope, channelDevtools, setChannelErrorHandler, resetChannelTabs } = C;

const tick = () => new Promise((r) => setTimeout(r, 0));
let n = 0;
const uniq = (base) => `${base}.${++n}`; // every test uses its own names: the app-wide bus is shared

test("emit / on / once / off / last / history", async () => {
  const c = channel(uniq("t.basic"));
  const got = [];
  const fn = (p) => got.push(p);
  c.on(fn);
  c.once((p) => got.push(`once:${p}`));
  c.emit(1); c.emit(2);
  assert.deepEqual(got, [1, "once:1", 2]);
  assert.equal(c.last(), 2);
  assert.deepEqual(c.history(), [], "nothing kept without sticky/replay");
  c.off(fn); c.emit(3);
  assert.deepEqual(got, [1, "once:1", 2]);
  assert.equal(c.listeners(), 0);
  const pr = c.once(); c.emit(4);
  assert.equal(await pr, 4);
});

test("a lazy listener that comes late gets the sticky value / the replayed messages", async () => {
  const sticky = channel(uniq("t.sticky"), { sticky: true });
  sticky.emit({ v: 1 }); sticky.emit({ v: 2 });
  const late = [];
  sticky.on((p) => late.push(p.v));
  assert.deepEqual(late, [2], "only the last one");
  const skip = [];
  sticky.on((p) => skip.push(p), { replay: false });
  assert.deepEqual(skip, []);

  const rep = channel(uniq("t.replay"), { replay: 3 });
  for (let i = 1; i <= 5; i++) rep.emit(i);
  const got = [];
  rep.on((p) => got.push(p));
  assert.deepEqual(got, [3, 4, 5], "last n, oldest first");
  assert.deepEqual(rep.history(), [3, 4, 5]);
  let once = 0;
  rep.once((p) => { once = p; });
  assert.equal(once, 5, "once takes the newest kept message");
  assert.equal(await rep.once(), 5);

  // a component that mounts later (lazy chunk) renders the last state at once
  const el = document.createElement("div");
  const stickyName = channel(uniq("t.lazy"), { sticky: true });
  stickyName.emit("ready");
  render(() => {
    const sel = stickyName.toSignal();
    return h("p", {}, () => sel() ?? "none");
  }, el);
  assert.equal(el.textContent, "ready");
  stickyName.emit("again");
  assert.equal(el.textContent, "again");
});

test("automatic cleanup: listeners leave with their component (no leak)", () => {
  const c = channel(uniq("t.clean"));
  const show = signal(true);
  const got = [];
  const Child = () => { c.on((p) => got.push(p)); c.on(() => {}, { priority: 5 }); return h("span", {}, "child"); };
  const el = document.createElement("div");
  render(() => h(If, { when: show }, () => h(Child, {})), el);
  assert.equal(c.listeners(), 2);
  c.emit(1);
  show.set(false);
  assert.equal(c.listeners(), 0, "removed with the branch");
  c.emit(2);
  assert.deepEqual(got, [1]);
  // mount and unmount many times: the listener count stays flat
  for (let i = 0; i < 200; i++) { show.set(true); show.set(false); }
  assert.equal(c.listeners(), 0);
  // a root disposes its listeners, the wildcard ones too
  const g = defineChannels({ [uniq("w.a")]: of() });
  createRoot((dispose) => { g.on("*", () => {}); assert.equal(channelDevtools.wildcards() > 0, true); dispose(); });
  assert.equal(channelDevtools.wildcards(), 0);
});

test("scope: two copies of a widget do not hear each other; unscoped channels stay app-wide", () => {
  const sel = channel(uniq("t.scoped"), { scoped: true, sticky: true });
  const app = channel(uniq("t.app"));
  const heard = { a: [], b: [] };
  const emitters = {};
  const appHeard = [];
  const Widget = (props) => {
    const s = useChannel(sel); // bound to this scope: safe in event handlers
    s.on((p) => heard[props.id].push(p));
    app.on((p) => appHeard.push(`${props.id}:${p}`));
    emitters[props.id] = (v) => s.emit(v);
    return h("div", {}, () => s.toSignal()() ?? "-");
  };
  const el = document.createElement("div");
  render(() => [h(ChannelScope, { label: "A" }, () => h(Widget, { id: "a" })), h(ChannelScope, { label: "B" }, () => h(Widget, { id: "b" }))], el);
  emitters.a("x");
  assert.deepEqual(heard, { a: ["x"], b: [] });
  emitters.b("y");
  assert.deepEqual(heard, { a: ["x"], b: ["y"] });
  assert.equal(el.textContent, "xy", "each copy keeps its own sticky value");
  assert.equal(sel.last(), undefined, "the app-wide bus never saw them");
  app.emit(1);
  assert.deepEqual(appHeard, ["a:1", "b:1"]);
});

test("wildcards, priority, async delivery", async () => {
  const pre = uniq("shop");
  const g = defineChannels({ [`${pre}.cart.add`]: of(), [`${pre}.cart.clear`]: of(), [`${pre}.user`]: of() });
  const seen = [];
  const off = g.on(`${pre}.cart.*`, (m) => seen.push(m.name.slice(pre.length + 1)));
  g[`${pre}.cart.add`].emit(1); g[`${pre}.cart.clear`].emit(); g[`${pre}.user`].emit("u");
  assert.deepEqual(seen, ["cart.add", "cart.clear"]);
  off();
  g[`${pre}.cart.add`].emit(2);
  assert.equal(seen.length, 2);

  const c = channel(uniq("t.prio"));
  const order = [];
  c.on(() => order.push("a"));
  c.on(() => order.push("high"), { priority: 10 });
  c.on(() => order.push("b"));
  c.on(() => order.push("async"), { async: true });
  c.on(() => order.push("low"), { priority: -1 });
  c.emit();
  order.push("after emit");
  await tick();
  assert.deepEqual(order, ["high", "a", "b", "low", "after emit", "async"]);

  const a = channel(uniq("t.async"), { async: true });
  const got = [];
  a.on((p) => got.push(p));
  a.emit(1);
  assert.deepEqual(got, []);
  await tick();
  assert.deepEqual(got, [1]);
});

test("error isolation: one failing listener does not stop the others", () => {
  const c = channel(uniq("t.err"));
  const errors = [];
  setChannelErrorHandler((e, info) => errors.push([e.message, info.channel === c.name]));
  const got = [];
  const offBoom = c.on(() => { throw new Error("boom"); }, { priority: 1 });
  c.on((p) => got.push(p));
  c.emit(7);
  assert.deepEqual(got, [7]);
  assert.deepEqual(errors, [["boom", true]]);
  setChannelErrorHandler(null);
  offBoom();
  // without a handler the error reaches the listener's own boundary
  const caught = [];
  createRoot(() => catchError(() => c.on(() => { throw new Error("inner"); }), (e) => caught.push(e.message)));
  c.emit(8);
  assert.deepEqual(caught, ["inner"]);
  assert.deepEqual(got, [7, 8]);
});

test("emit loops are stopped", () => {
  const c = channel(uniq("t.loop"));
  const errors = [];
  setChannelErrorHandler((e) => errors.push(e.message));
  c.on((p) => c.emit(p + 1));
  c.emit(0);
  setChannelErrorHandler(null);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /loop/);
});

test("crossTab: messages and the sticky value travel through BroadcastChannel (mock)", async () => {
  // two "tabs" = two module instances sharing one fake BroadcastChannel network
  const net = new Set();
  class FakeBC {
    constructor(name) { this.name = name; this.onmessage = null; net.add(this); }
    postMessage(data) {
      const copy = structuredClone(data); // the same rules as the real one: DataCloneError for functions, DOM nodes…
      for (const o of net) if (o !== this && o.name === this.name) queueMicrotask(() => o.onmessage?.({ data: structuredClone(copy) }));
    }
    close() { net.delete(this); }
  }
  globalThis.BroadcastChannel = FakeBC;
  resetChannelTabs();
  const other = await import("../src/channel/index.ts?tab=2");
  const name = uniq("t.tab");
  const here = channel(name, { crossTab: true, sticky: true });
  const there = other.channel(name, { crossTab: true, sticky: true });
  const got = [];
  there.on((p, from) => got.push([p.count, from]));
  here.emit({ count: 2 });
  await tick();
  assert.deepEqual(got, [[2, "tab"]]);
  assert.deepEqual(there.last(), { count: 2 });

  // a tab that opens later asks the others for the sticky value
  const late = await import("../src/channel/index.ts?tab=3");
  const lateCh = late.channel(name, { crossTab: true, sticky: true });
  await tick(); await tick();
  assert.deepEqual(lateCh.last(), { count: 2 });

  // a payload that cannot be cloned still reaches this tab; the error is reported
  const errors = [];
  setChannelErrorHandler((e) => errors.push(e.name));
  const local = [];
  here.on((p) => local.push(typeof p.fn), { replay: false });
  here.emit({ count: 3, fn: () => {} });
  setChannelErrorHandler(null);
  assert.deepEqual(local, ["function"]);
  assert.deepEqual(errors, ["DataCloneError"]);

  // a channel without crossTab never posts
  const before = got.length;
  other.channel(`${name}.x`).on(() => got.push("x"));
  channel(`${name}.x`).emit(1);
  await tick();
  assert.equal(got.length, before);
  delete globalThis.BroadcastChannel;
  resetChannelTabs(); other.resetChannelTabs(); late.resetChannelTabs();
});

test("dev traffic log and devtools table", () => {
  const c = channel(uniq("t.log"), { sticky: true });
  channelDevtools.clear();
  const live = [];
  const off = channelDevtools.watch((e) => live.push(e.name));
  c.on(() => {});
  c.emit({ a: 1 });
  off();
  c.emit({ a: 2 });
  const log = channelDevtools.traffic();
  assert.equal(log.length, 2);
  assert.deepEqual(log[0].payload, { a: 1 });
  assert.equal(log[0].from, "local");
  assert.equal(log[0].listeners, 1);
  assert.deepEqual(live, [c.name]);
  const row = channelDevtools.channels().find((x) => x.name === c.name);
  assert.deepEqual(row.last, { a: 2 });
  assert.equal(row.listeners, 1);
  channelDevtools.configure({ size: 1 });
  assert.equal(channelDevtools.traffic().length, 1);
  channelDevtools.configure({ enabled: false, size: 200 });
  c.emit({ a: 3 });
  assert.equal(channelDevtools.traffic().length, 1);
  channelDevtools.configure({ enabled: true });
});

test("toSignal drives effects; emits inside batch-free handlers stay synchronous", () => {
  const c = channel(uniq("t.sig"));
  const seen = [];
  createRoot(() => { const s = c.toSignal(); effect(() => seen.push(s())); });
  c.emit(1); c.emit(1);
  assert.deepEqual(seen, [undefined, 1, 1], "equal payloads still notify (events, not state)");
});
