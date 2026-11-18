import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { installDom, serialize } from "../src/testing/dom.ts";
import { compile } from "../compiler/index.js";
const { document } = installDom();
const RT = new URL("../src/index.ts", import.meta.url).href;
const M = await import(RT);
const { h, render, signal, Try, generator, onCleanup, lazyChildren, getOwner, _enter, _leave } = M;

const tick = () => new Promise((r) => setTimeout(r, 0));
const frames = async (n = 1) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 20)); };
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose, html: () => serialize(el) }; };
const texts = (el, sel = "li") => el.querySelectorAll(sel).map((x) => x.textContent);

test("sync generator: each yield is added after the last; the first chunk is drawn at once, the rest frame by frame", async () => {
  let pulled = 0;
  const List = generator(function* List(p) { for (let i = 0; i < p.n; i++) { pulled++; yield h("li", {}, String(i)); } }, { chunk: 3 });
  const { el } = mount(() => h("ul", {}, h("li", {}, "head"), h(List, { n: 8 }), h("li", {}, "tail")));
  assert.deepEqual(texts(el), ["head", "0", "1", "2", "tail"], "first chunk synchronous, in place");
  assert.equal(pulled, 3, "the generator is not run ahead of the chunk");
  await frames(4);
  assert.deepEqual(texts(el), ["head", "0", "1", "2", "3", "4", "5", "6", "7", "tail"]);
});

test("sync generator without chunk: a time slice per frame (a short list is drawn whole at once)", () => {
  const List = generator(function* List() { for (let i = 0; i < 50; i++) yield h("li", {}, String(i)); });
  const { el } = mount(() => h("ul", {}, h(List, {})));
  assert.equal(texts(el).length, 50);
});

test("removing a sync generator stops a half-drawn list and runs its finally", async () => {
  const show = signal(true);
  let closed = 0, pulled = 0;
  const List = generator(function* List() { try { for (let i = 0; i < 100; i++) { pulled++; yield h("li", {}, String(i)); } } finally { closed++; } }, { chunk: 2 });
  const { el } = mount(() => h("ul", {}, () => (show() ? h(List, {}) : null)));
  assert.equal(texts(el).length, 2);
  show.set(false);
  assert.equal(closed, 1, "return() ran the finally block");
  assert.equal(texts(el).length, 0);
  await frames(3);
  assert.equal(pulled, 2, "no part is pulled after removal");
  assert.equal(texts(el).length, 0);
});

test("async generator: Try loading until the first value, then each yield replaces the last", async () => {
  const gate = [];
  const next = () => new Promise((r) => gate.push(r));
  const Clock = generator(async function* Clock() { yield h("b", {}, "1"); await next(); yield h("b", {}, "2"); await next(); yield h("b", {}, "3"); });
  const Slow = generator(async function* Slow() { await next(); yield h("b", {}, "slow"); });
  const { el } = mount(() => h(Try, { loading: () => h("i", {}, "…"), log: false }, lazyChildren(() => [h(Slow, {})])));
  assert.equal(el.textContent, "…");
  gate.shift()(); await tick(); await tick();
  assert.equal(el.textContent, "slow");
  assert.equal(el.querySelectorAll("i").length, 0, "loading is gone");
  const m = mount(() => h("p", {}, h(Clock, {})));
  await tick(); await tick();
  assert.equal(m.el.textContent, "1");
  gate.shift()(); await tick(); await tick();
  assert.equal(m.el.textContent, "2");
  assert.equal(m.el.querySelectorAll("b").length, 1, "replaced, not added");
  gate.shift()(); await tick(); await tick();
  assert.equal(m.el.textContent, "3");
});

test("async generator without a Try shows the default spinner first", async () => {
  const A = generator(async function* A() { await tick(); yield "done"; });
  const { el } = mount(() => h("div", {}, h(A, {})));
  assert.equal(el.querySelectorAll(".m-loading").length, 1);
  await tick(); await tick(); await tick();
  assert.equal(el.textContent, "done");
  assert.equal(el.querySelectorAll(".m-loading").length, 0);
});

test("async generator errors go to Try fallback (before and after the first value)", async () => {
  const Early = generator(async function* Early() { await tick(); throw new Error("early"); });
  const m1 = mount(() => h(Try, { fallback: (e) => `caught ${e.message}`, log: false }, lazyChildren(() => [h(Early, {})])));
  await tick(); await tick(); await tick();
  assert.equal(m1.el.textContent, "caught early");
  const Late = generator(async function* Late() { yield "ok"; await tick(); throw new Error("late"); });
  const m2 = mount(() => h(Try, { fallback: (e) => `caught ${e.message}`, log: false }, lazyChildren(() => [h(Late, {})])));
  await tick(); await tick(); await tick(); await tick();
  assert.equal(m2.el.textContent, "caught late");
  const Sync = generator(function* Sync() { yield "a"; throw new Error("sync"); });
  const m3 = mount(() => h(Try, { fallback: (e) => `caught ${e.message}`, log: false }, lazyChildren(() => [h(Sync, {})])));
  assert.equal(m3.el.textContent, "caught sync");
});

test("removing an async generator: return() runs, a value that arrives after the await is not drawn", async () => {
  const show = signal(true);
  let release, closed = 0, after = 0;
  const A = generator(async function* A() {
    try { yield h("b", {}, "first"); await new Promise((r) => { release = r; }); after++; yield h("b", {}, "second"); }
    finally { closed++; }
  });
  const { el } = mount(() => h("div", {}, () => (show() ? h(A, {}) : "gone")));
  await tick(); await tick();
  assert.equal(el.textContent, "first");
  show.set(false);
  assert.equal(el.textContent, "gone");
  release(); await tick(); await tick(); await tick();
  assert.equal(el.textContent, "gone", "the late value is not drawn");
  assert.equal(closed, 1, "finally ran (return() after the pending step)");
  assert.equal(after <= 1, true);
});

test("yields: 'append' on an async generator adds each message (a chat stream); 'replace' on a sync one keeps the last", async () => {
  async function* source() { yield "a"; await tick(); yield "b"; await tick(); yield "c"; }
  const Chat = generator(async function* Chat() { for await (const m of source()) yield h("li", {}, m); }, { yields: "append" });
  const { el } = mount(() => h("ul", {}, h(Chat, {})));
  for (let i = 0; i < 8; i++) await tick();
  assert.deepEqual(texts(el), ["a", "b", "c"]);
  const Steps = generator(function* Steps() { yield "one"; yield "two"; yield "three"; }, { yields: "replace" });
  const m = mount(() => h("p", {}, h(Steps, {})));
  assert.equal(m.el.textContent, "three");
});

test("replace mode disposes what the previous step created (a ticking clock does not pile up effects)", async () => {
  const s = signal(0);
  let live = 0, gate;
  const Item = () => { live++; onCleanup(() => live--); return h("b", {}, () => String(s())); };
  // what the compiler emits for `await` in a generator component: the owner is back after it
  const Clock = generator(async function* Clock() { const o = getOwner(); for (let i = 0; i < 4; i++) { yield h(Item, {}); _enter(o, await _leave(new Promise((r) => { gate = r; }))); } });
  const { el, dispose } = mount(() => h("p", {}, h(Clock, {})));
  await tick(); await tick();
  for (let i = 0; i < 3; i++) { gate(); await tick(); await tick(); }
  assert.equal(live, 1, "only the visible step is alive");
  s.set(7);
  assert.equal(el.textContent, "7");
  dispose();
  assert.equal(live, 0);
});

test("compiled: function* / async function* declarations are components, for await keeps the owner, statics configure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "march-gen-"));
  try {
    const src = `
import { context, useContext, h } from ${JSON.stringify(RT)};
export const Theme = context("light");
export function* List(props: { n: number }) { for (let i = 0; i < props.n; i++) yield <li>{i}</li>; }
List.chunk = 2;
async function* feed() { yield "x"; yield "y"; }
export async function* Chat() { for await (const m of feed()) { yield <li>{m}:{useContext(Theme)}</li>; } }
Chat.yields = "append";
export default async function* Clock() { yield <b>one</b>; await null; yield <b>{useContext(Theme)}</b>; }
function* range(n) { for (let i = 0; i < n; i++) yield i; }
export const nums = [...range(3)];
`;
    const out = compile(src, { runtime: RT, filename: "gen.tsx" }).code;
    const f = join(dir, "gen.mjs");
    const esbuild = await import("esbuild");
    writeFileSync(f, (await esbuild.transform(out, { loader: "ts" })).code);
    const mod = await import(pathToFileURL(f).href);
    assert.deepEqual(mod.nums, [0, 1, 2], "a lowercase generator stays a plain generator");
    const ul = mount(() => h("ul", {}, h(mod.List, { n: 5 })));
    assert.deepEqual(texts(ul.el), ["0", "1"], "List.chunk = 2");
    await frames(3);
    assert.deepEqual(texts(ul.el), ["0", "1", "2", "3", "4"]);
    const chat = mount(() => h(mod.Theme.Provider, { value: "dark" }, lazyChildren(() => [h("ul", {}, h(mod.Chat, {}))])));
    for (let i = 0; i < 6; i++) await tick();
    assert.deepEqual(texts(chat.el), ["x:dark", "y:dark"], "context works after for await; yields = append");
    const clock = mount(() => h(mod.Theme.Provider, { value: "dark" }, lazyChildren(() => [h(mod.default, {})])));
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(clock.el.textContent, "dark", "after await the owner (and its context) is back");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("compiler: only capitalised generator declarations are wrapped; for await keeps working", () => {
  const out = compile(`const A = function* B() { yield 1 }
const o = { *Gen() { yield 2 } };
export default async function* Feed<T>(p: T) { for await (const x of p) { yield x } }
async function g() { for await (const x of y) z(x); }`, { runtime: RT }).code;
  assert.match(out, /const A = function\* B\(\)/, "an expression is left alone");
  assert.match(out, /\*Gen\(\)/);
  assert.match(out, /export default +function Feed\(p\)\{return _\$gen\(_\$gFeed\(p\),Feed\)\}async function\* _\$gFeed<T>\(p: T\)/);
  assert.match(out, /for await \(const x of p\) \{_\$enter\(_\$o,0\);/);
  assert.match(out, /for await \(const x of y\) z\(x\);/, "a body without braces compiles (the owner is not restored there)");
});
