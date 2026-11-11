import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, serialize } from "../src/testing/dom.js";
const { document } = installDom();
const M = await import("../src/index.js");
const { signal, computed, effect, batch, untrack, onCleanup, createRoot, store, patch, h, render, If, For, Switch, Match, Try, Await, context, useContext, provide, reactive, pipe, applyPipe, t, messages, setLocale, locale, sx } = M;

const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose, html: () => serialize(el) }; };

test("signal / computed / effect basics", () => {
  const a = signal(1), b = signal(2);
  let runs = 0;
  const sum = computed(() => { runs++; return a() + b(); });
  const seen = [];
  const stop = effect(() => seen.push(sum()));
  a.set(5); b.update((x) => x + 1);
  assert.deepEqual(seen, [3, 7, 8]);
  assert.equal(runs, 3);
  a.set(5); // same value: no run
  assert.equal(runs, 3);
  stop();
  a.set(0);
  assert.deepEqual(seen, [3, 7, 8]);
});

test("glitch free diamond and batch", () => {
  const a = signal(1);
  const b = computed(() => a() * 2), c = computed(() => a() + 1);
  const seen = [];
  effect(() => seen.push(`${b()}-${c()}`));
  batch(() => { a.set(2); a.set(3); });
  assert.deepEqual(seen, ["2-2", "6-4"]);
});

test("computed only propagates when its value changes", () => {
  const a = signal(1);
  const even = computed(() => a() % 2 === 0);
  let n = 0;
  effect(() => { even(); n++; });
  a.set(3); a.set(5);
  assert.equal(n, 1);
  a.set(4);
  assert.equal(n, 2);
});

test("untrack and peek do not subscribe", () => {
  const a = signal(1), b = signal(1);
  let n = 0;
  effect(() => { a(); untrack(() => b()); b.peek(); n++; });
  b.set(2);
  assert.equal(n, 1);
});

test("ownership: cleanups run on re-run and dispose", () => {
  const a = signal(1);
  const log = [];
  const dispose = createRoot((d) => { effect(() => { const v = a(); onCleanup(() => log.push(`clean ${v}`)); }); return d; });
  a.set(2);
  dispose();
  assert.deepEqual(log, ["clean 1", "clean 2"]);
});

test("store: per-property tracking and patch", () => {
  const s = store({ user: { name: "Ada", age: 36 }, tags: ["a"] });
  const names = [], ages = [];
  effect(() => names.push(s.user.name));
  effect(() => ages.push(s.user.age));
  s.user.name = "Grace";
  patch(s, { user: { age: 37 } });
  s.tags.push("b");
  assert.deepEqual(names, ["Ada", "Grace"]);
  assert.deepEqual(ages, [36, 37]);
  assert.equal(s.tags.length, 2);
});

test("context", () => {
  const Ctx = context("default");
  let got;
  const Child = () => { got = useContext(Ctx); return null; };
  createRoot(() => { provide(Ctx, "given"); h(Child, {}); });
  assert.equal(got, "given");
});

test("h(): static and live text, attributes, classes", () => {
  const n = signal(1), on = signal(false);
  const { el, html } = mount(() => h("p", { class: "x", "class:active": on, title: () => `n=${n()}` }, "count ", n));
  assert.equal(serialize(el.querySelector("p")), '<p class="x" title="n=1">count 1</p>');
  const text = el.querySelector("p").childNodes.find((c) => c.nodeType === 3 && c.data === "1");
  n.set(2); on.set(true);
  assert.equal(el.querySelector("p").getAttribute("title"), "n=2");
  assert.ok(el.querySelector("p").classList.contains("active"));
  assert.equal(text.data, "2", "same text node updated in place");
});

test("h(): events with modifiers, cleanup removes listeners", () => {
  let clicks = 0;
  const { el, dispose } = mount(() => h("button", { "on:click|prevent": (e) => { clicks++; assert.ok(e.defaultPrevented); } }, "go"));
  const b = el.querySelector("button");
  b.click(); b.click();
  assert.equal(clicks, 2);
  dispose();
  b.click();
  assert.equal(clicks, 2);
  assert.equal(el.childNodes.length, 0);
});

test("h(): security — no innerHTML, no script, unsafe URLs blocked", () => {
  assert.throws(() => h("div", { innerHTML: "<b>x</b>" }), /not supported/);
  assert.throws(() => h("script", {}), /cannot be created/);
  const prev = M.DEV.warn; M.DEV.warn = () => {};
  const a = h("a", { href: "javascript:alert(1)" });
  M.DEV.warn = prev;
  assert.equal(a.getAttribute("href"), "about:blank");
  assert.equal(h("a", { href: "/ok?x=1" }).getAttribute("href"), "/ok?x=1");
  assert.equal(h("p", {}, "<b>").textContent, "<b>");
  assert.throws(() => h("div", { style: "color:red" }), /CSP/);
});

test("bind:value / bind:checked", () => {
  const v = signal("a"), c = signal(false);
  const { el } = mount(() => [h("input", { "bind:value": v }), h("input", { type: "checkbox", "bind:checked": c })]);
  const [i, cb] = el.querySelectorAll("input");
  assert.equal(i.value, "a");
  i.value = "b"; i.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(v(), "b");
  v.set("c");
  assert.equal(i.value, "c");
  cb.checked = true; cb.dispatchEvent(new Event("change"));
  assert.equal(c(), true);
});

test("components: props are live via reactive accessors; bind on components", () => {
  const name = signal("Ada");
  const Hello = (p) => h("b", {}, () => `Hi ${p.name}`);
  const val = signal(1);
  let setter;
  const Inp = (p) => { setter = p.setValue; return h("i", {}, () => p.value); };
  const { el } = mount(() => [h(Hello, { name: reactive(() => name()) }), h(Inp, { "bind:value": val })]);
  name.set("Grace");
  assert.equal(el.querySelector("b").textContent, "Hi Grace");
  setter(5);
  assert.equal(el.querySelector("i").textContent, "5");
});

test("If / Else branch disposal", () => {
  const show = signal(true);
  const log = [];
  const A = () => { onCleanup(() => log.push("A gone")); return h("span", {}, "A"); };
  const { el } = mount(() => h("div", {}, h(If, { when: show, else: () => h("em", {}, "B") }, M.lazy(() => [h(A, {})]))));
  assert.equal(el.textContent, "A");
  show.set(false);
  assert.equal(el.textContent, "B");
  assert.deepEqual(log, ["A gone"]);
  show.set(true);
  assert.equal(el.textContent, "A");
});

test("For: keyed reuse, reorder, update in place, removal", () => {
  const items = signal([{ id: 1, n: "a" }, { id: 2, n: "b" }, { id: 3, n: "c" }]);
  let created = 0;
  const { el } = mount(() => h("ul", {}, h(For, { each: items, key: "id" }, M.lazy(() => [(it) => { created++; return h("li", {}, () => it().n); }]))));
  const lis = () => el.querySelectorAll("li");
  assert.equal(lis().map((x) => x.textContent).join(), "a,b,c");
  const first = lis()[0];
  items.set([{ id: 3, n: "c" }, { id: 1, n: "A" }, { id: 4, n: "d" }]);
  assert.equal(lis().map((x) => x.textContent).join(), "c,A,d");
  assert.equal(created, 4);
  assert.equal(lis()[1], first, "row for id 1 reused");
  items.set([]);
  assert.equal(lis().length, 0);
});

test("Switch / Match", () => {
  const s = signal("b");
  const { el } = mount(() => h(Switch, { fallback: () => "none" }, M.lazy(() => [
    h(Match, { when: () => s() === "a" }, M.lazy(() => ["A"])),
    h(Match, { when: () => s() === "b" }, M.lazy(() => ["B"])),
  ])));
  assert.equal(el.textContent, "B");
  s.set("z");
  assert.equal(el.textContent, "none");
});

test("Try catches render errors and async component errors; async components show then resolve", async () => {
  const Boom = () => { throw new Error("bad"); };
  const { el } = mount(() => h(Try, { fallback: (e, reset) => h("p", {}, `oops ${e.message}`), log: false }, M.lazy(() => [h(Boom, {})])));
  assert.equal(el.textContent, "oops bad");
  const Late = async () => { await tick(); return h("b", {}, "ready"); };
  const m2 = mount(() => h(Try, { loading: () => "…", log: false }, M.lazy(() => [h(Late, {})])));
  assert.equal(m2.el.textContent, "…");
  await tick(); await tick();
  assert.equal(m2.el.textContent, "ready");
  const Fail = async () => { await tick(); throw new Error("late"); };
  const m3 = mount(() => h(Try, { fallback: (e) => `caught ${e.message}`, log: false }, M.lazy(() => [h(Fail, {})])));
  await tick(); await tick();
  assert.equal(m3.el.textContent, "caught late");
});

test("Await", async () => {
  const { el } = mount(() => h(Await, { for: Promise.resolve(41), loading: "wait" }, M.lazy(() => [(v) => `got ${v + 1}`])));
  assert.equal(el.textContent, "wait");
  await tick();
  assert.equal(el.textContent, "got 42");
});

test("pipes and i18n follow the locale", () => {
  setLocale("en");
  assert.equal(applyPipe("money", 1234.5, "USD"), "$1,234.50");
  assert.equal(applyPipe("upper", "abc"), "ABC");
  pipe("twice", (v) => v * 2);
  assert.equal(applyPipe("twice", 2), 4);
  assert.throws(() => applyPipe("nope", 1), /unknown pipe/);
  messages("tr", { "Hello {0}": "Merhaba {0}" });
  const who = signal("Ada");
  const { el } = mount(() => h("p", {}, () => t`Hello ${who()}`));
  assert.equal(el.textContent, "Hello Ada");
  setLocale("tr");
  assert.equal(el.textContent, "Merhaba Ada");
  assert.equal(applyPipe("upper", "iı"), "İI");
  setLocale("en");
  assert.equal(locale(), "en");
});

test("sx resolves tokens to classes and rejects unknown ones", () => {
  assert.equal(sx({ p: 2, gap: 1, cols: 3 }), "hm-p-2 hm-gap-1 hm-cols-3");
  assert.throws(() => sx({ p: 99 }), /out of range/);
  assert.throws(() => sx({ zz: 1 }), /unknown sx key/);
});

test("components created outside an owner still get context and cleanups", () => {
  const Ctx = context("d");
  let seen;
  const Inner = () => { seen = useContext(Ctx); return null; };
  const Outer = () => { provide(Ctx, "x"); onCleanup(() => {}); return h(Inner, {}); };
  h(Outer, {}); // no render() root around it
  assert.equal(seen, "x");
});
