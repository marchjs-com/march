// Extensions and interceptors (src/dom/extend.ts): extend / intercept / defineExtension, the scope (<Extensions>,
// withExtensions), m:extend, order, liveness, cleanup, error isolation, render wrap / replace, the tools' view.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../compiler/index.js";
import { installDom, Event } from "../src/testing/dom.ts";

const { document } = installDom();
const RT = new URL("../src/index.ts", import.meta.url).href;
const M = await import("../src/index.ts");
const { h, render, signal, reactive, extend, intercept, defineExtension, withExtensions, Extensions, extensions, effect } = M;

const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
function Button(p) { return h("button", { class: () => `btn ${p.size ?? "md"}`, onClick: p.onClick, "data-variant": p.variant }, () => p.children); }
function Card(p) { return h("div", { class: "card" }, p.title); }
const quiet = async (fn) => { const err = console.error, warn = M.DEV.warn, seen = []; console.error = (...a) => seen.push(a.join(" ")); try { await fn(); } finally { console.error = err; M.DEV.warn = warn; } return seen; };

test("extend: a new prop with setup; the component never sees it; setup gets live props, roots and cleanup", () => {
  const sent = [], seen = [];
  function Plain(p) { seen.push(Object.keys(p).sort().join(",")); return h("button", null, "x"); }
  const track = defineExtension({
    name: "track",
    props: { track: { type: "string", doc: "event" } },
    setup({ props, roots, onCleanup }) {
      const send = () => sent.push(props.track);
      for (const el of roots()) { el.addEventListener("click", send); onCleanup(() => { sent.push("off"); el.removeEventListener("click", send); }); }
    },
  });
  const off = extend([Plain], track);
  const ev = signal("save");
  const { host, dispose } = mount(() => h(Plain, { track: reactive(() => ev()), label: "a" }));
  assert.equal(seen[0], "label", "the added prop is kept out of the component's own props");
  host.querySelector("button").dispatchEvent(new Event("click"));
  ev.set("save2");
  host.querySelector("button").dispatchEvent(new Event("click"));
  assert.deepEqual(sent, ["save", "save2"], "props are read live");
  dispose();
  assert.deepEqual(sent.at(-1), "off", "cleanup runs with the instance");
  off();
  const again = mount(() => h(Plain, { track: "x" }));
  again.host.querySelector("button").dispatchEvent(new Event("click"));
  assert.equal(sent.length, 3, "removed: nothing runs");
  assert.equal(seen.at(-1), "track", "removed: the prop is the component's again");
  again.dispose();
});

test('extend("*"): runs only on instances given one of its props; a function target is a component, { test } a test', () => {
  let runs = 0;
  const off = extend("*", { name: "tid", props: { tid: { type: "string" } }, setup: ({ props, roots }) => { runs++; for (const el of roots()) el.setAttribute("data-tid", props.tid); } });
  const { host, dispose } = mount(() => [h(Card, { title: "a" }), h(Card, { title: "b", tid: "two" })]);
  assert.equal(runs, 1);
  assert.equal(host.querySelectorAll(".card")[1].getAttribute("data-tid"), "two");
  dispose(); off();
  assert.throws(() => intercept("*", { name: "x", props: () => ({}) }), /named components/);
  assert.throws(() => extend("*", { name: "x", render: (n) => n() }), /only adds props/);
  const off2 = intercept({ test: (c, info) => info.name === "Card" }, { name: "by-name", props: () => ({ title: "tested" }) });
  const r = mount(() => [h(Card, { title: "a" }), h(Button, {}, "b")]);
  assert.equal(r.host.querySelector(".card").textContent, "tested");
  r.dispose(); off2();
});

test("intercept props: merged over the given props, live (compiler thunks and reactive() stay live), re-runs on what it reads", () => {
  const off = intercept(Button, { name: "small", props: (p) => ({ size: p.size ?? "sm" }) });
  const size = signal(undefined);
  const { host, dispose } = mount(() => [h(Button, {}, "a"), h(Button, { size: reactive(() => size()) }, "b")]);
  const [a, b] = host.querySelectorAll("button");
  assert.equal(a.className, "btn sm");
  assert.equal(b.className, "btn sm");
  size.set("lg");
  assert.equal(b.className, "btn lg", "the interceptor re-runs when what it read changes");
  size.set(undefined);
  assert.equal(b.className, "btn sm");
  dispose(); off();
  const r = mount(() => h(Button, {}, "c"));
  assert.equal(r.host.querySelector("button").className, "btn md", "removed");
  r.dispose();
});

test("intercept on: wraps callbacks (next calls the original, not calling it stops the event); a callback can be added", async () => {
  const log = [];
  let allow = false;
  const off = intercept(Button, { name: "confirm", on: { onClick: (next, e, p) => { log.push(`ask:${p.variant}`); if (p.variant !== "danger" || allow) return next(e); } } });
  const { host, dispose } = mount(() => [h(Button, { variant: "danger", onClick: () => log.push("delete") }, "x"), h(Button, { variant: "plain" }, "y")]);
  const [d, plain] = host.querySelectorAll("button");
  d.dispatchEvent(new Event("click", { bubbles: true }));
  assert.deepEqual(log, ["ask:danger"], "stopped");
  allow = true;
  d.dispatchEvent(new Event("click", { bubbles: true }));
  assert.deepEqual(log, ["ask:danger", "ask:danger", "delete"]);
  plain.dispatchEvent(new Event("click", { bubbles: true }));
  assert.deepEqual(log.at(-1), "ask:plain", "a callback the caller did not pass is added");
  dispose(); off();
});

test("intercept render: wraps the output, or replaces it entirely (next not called); next(p) may change the props", () => {
  const offA = intercept(Card, { name: "badge", props: { isNew: { type: "boolean" } }, render: (next, p) => (p.isNew ? h("section", { class: "new" }, next()) : next()) });
  const { host, dispose } = mount(() => [h(Card, { title: "a", isNew: true }), h(Card, { title: "b" })]);
  assert.equal(host.querySelector("section.new .card").textContent, "a");
  assert.equal(host.querySelectorAll("section").length, 1);
  dispose(); offA();
  let calls = 0;
  function Counted() { calls++; return h("i", null, "inner"); }
  const offB = intercept(Counted, { name: "replace", render: () => h("b", null, "replaced") });
  const r = mount(() => h(Counted, {}));
  assert.equal(r.host.querySelector("b").textContent, "replaced");
  assert.equal(r.host.querySelector("i"), null);
  assert.equal(calls, 0, "the component did not run");
  r.dispose(); offB();
  const offC = intercept(Card, { name: "retitle", render: (next, p) => next({ ...p, title: p.title.toUpperCase() }) });
  const r2 = mount(() => h(Card, { title: "up" }));
  assert.equal(r2.host.textContent, "UP");
  r2.dispose(); offC();
});

test("order: registration order, `order` sets it (lower runs outer); same for props, callbacks and render", () => {
  const log = [];
  const offs = [
    intercept(Card, { name: "b", render: (next) => { log.push("b"); return next(); } }),
    intercept(Card, { name: "a", order: -1, render: (next) => { log.push("a"); return next(); } }),
    intercept(Card, { name: "c", render: (next) => { log.push("c"); return next(); } }),
    intercept(Card, { name: "p1", props: () => ({ title: "one" }) }),
    intercept(Card, { name: "p2", props: (p) => ({ title: `${p.title}+two` }) }),
  ];
  const { host, dispose } = mount(() => h(Card, { title: "x" }));
  assert.deepEqual(log, ["a", "b", "c"]);
  assert.equal(host.textContent, "one+two", "the inner interceptor sees what the outer one gave");
  dispose(); for (const o of offs) o();
});

test("scope: <Extensions use> / withExtensions reach only what is created inside (now or later), add to the global ones, nest", () => {
  const small = defineExtension({ name: "small", target: Button, props: (p) => ({ size: p.size ?? "sm" }) });
  const big = defineExtension({ name: "big", target: Button, props: () => ({ size: "xl" }) });
  const show = signal(false);
  const { host, dispose } = mount(() => [
    h("p", { id: "in" }, h(Extensions, { use: [small] }, () => [h(Button, {}, "a"), () => (show() ? h(Button, {}, "late") : null), h("div", { id: "deep" }, withExtensions([big], () => h(Button, {}, "d")))])),
    h("p", { id: "out" }, h(Button, {}, "b")),
  ]);
  assert.equal(host.querySelector("#in button").className, "btn sm");
  assert.equal(host.querySelector("#out button").className, "btn md", "outside the scope nothing changes");
  assert.equal(host.querySelector("#deep button").className, "btn xl", "the nearest scope adds (inner runs after)");
  show.set(true);
  assert.deepEqual([...host.querySelectorAll("#in button")].map((b) => b.className), ["btn sm", "btn sm", "btn xl"], "created later inside: reached");
  // [target, extension] items
  const r = mount(() => withExtensions([[Card, defineExtension({ name: "t", props: () => ({ title: "scoped" }) })]], () => h(Card, { title: "x" })));
  assert.equal(r.host.textContent, "scoped");
  r.dispose(); dispose();
});

test("m:extend={false | names}: an instance opts out of all, or keeps only the named ones; the compiler passes it to the pipeline", () => {
  const offs = [intercept(Card, { name: "one", props: (p) => ({ title: `${p.title}1` }) }), intercept(Card, { name: "two", props: (p) => ({ title: `${p.title}2` }) })];
  const seen = [];
  function Spy(p) { seen.push("m:extend" in p); return h("i"); }
  const { host, dispose } = mount(() => [h(Card, { title: "a" }), h(Card, { title: "b", "m:extend": false }), h(Card, { title: "c", "m:extend": ["two"] }), h(Spy, { "m:extend": false })]);
  assert.deepEqual([...host.querySelectorAll(".card")].map((x) => x.textContent), ["a12", "b", "c2"]);
  assert.deepEqual(seen, [false], "the component never sees m:extend");
  dispose(); for (const o of offs) o();
  const code = compile("const a = <Card m:extend={false} title=\"x\" />; const b = <Card m:extend={$names} />", { runtime: RT }).code;
  assert.match(code, /"m:extend": false/);
  assert.doesNotMatch(code, /mProps/, "not a common prop");
  assert.throws(() => compile("const a = <div m:extend={false} />", { runtime: RT }), /m:extend is for components/);
});

test("errors: a throwing extension is reported with its name and skipped; the component still renders", async () => {
  const seen = await quiet(() => {
    const offs = [
      intercept(Card, { name: "bad-props", props: () => { throw new Error("p"); } }),
      intercept(Card, { name: "bad-render", render: () => { throw new Error("r"); } }),
      extend(Card, { name: "bad-setup", setup: () => { throw new Error("s"); } }),
      intercept(Button, { name: "bad-on", on: { onClick: () => { throw new Error("o"); } } }),
    ];
    let clicked = 0;
    const { host, dispose } = mount(() => [h(Card, { title: "still" }), h(Button, { onClick: () => clicked++ }, "b")]);
    assert.equal(host.querySelector(".card").textContent, "still");
    host.querySelector("button").dispatchEvent(new Event("click", { bubbles: true }));
    assert.equal(clicked, 1, "a failing callback wrapper falls back to the original");
    dispose(); for (const o of offs) o();
  });
  for (const n of ["bad-props", "bad-render", "bad-setup", "bad-on"]) assert.ok(seen.some((s) => s.includes(`"${n}"`) && s.includes("<Card>") || s.includes(`"${n}"`) && s.includes("<Button>")), `${n} reported: ${seen.join(" | ")}`);
});

test("setup on a live-region output runs once its first value exists, under the instance's owner", () => {
  const log = [];
  function Live(p) { return () => h("span", { class: "live" }, p.label); }
  const off = extend(Live, { name: "mark", setup: ({ roots, onCleanup }) => { log.push(roots().map((r) => r.className).join()); onCleanup(() => log.push("bye")); } });
  const { dispose } = mount(() => h(Live, { label: "x" }));
  assert.deepEqual(log, ["live"]);
  dispose();
  assert.deepEqual(log, ["live", "bye"]);
  off();
});

test("tools: extensions.list() is reactive; extensions.of(el) tells what ran and what changed; propsOf lists added props", () => {
  const counts = [];
  const stop = M.createRoot((d) => { effect(() => counts.push(extensions.list().length)); return d; });
  const off1 = intercept(Card, { name: "retitle", props: () => ({ title: "T" }) });
  const off2 = extend([Card], { name: "flag", props: { flag: { type: "boolean", doc: "a flag" } }, setup() {} });
  assert.deepEqual(counts.slice(-1), [counts[0] + 2]);
  const row = extensions.list().find((r) => r.name === "retitle");
  assert.deepEqual([row.target, row.scope, row.does.join()], ["Card", "global", "props"]);
  const { host, dispose } = mount(() => h(Card, { title: "x", flag: true }));
  const t = extensions.of(host.querySelector(".card"));
  assert.equal(t.component, "Card");
  assert.deepEqual(t.steps.map((s) => `${s.name}:${s.did.join("+")}`), ["retitle:props", "flag:setup"]);
  assert.equal(t.steps[0].before.title, "x");
  assert.equal(t.steps[0].after.title, "T");
  assert.deepEqual(extensions.propsOf(Card).map((x) => x.extension), ["flag"]);
  dispose(); off1(); off2(); stop();
});

test("dev warning: two extensions adding the same prop to the same component", () => {
  const warns = [];
  const w = M.DEV.warn;
  M.DEV.warn = (...a) => warns.push(a.join(" "));
  const a = extend(Card, { name: "a", props: { tone: {} } }), b = extend([Card], { name: "b", props: { tone: {} } }), c = extend(Button, { name: "c", props: { tone: {} } });
  M.DEV.warn = w;
  assert.equal(warns.length, 1);
  assert.match(warns[0], /"a" and "b" both add the prop "tone"/);
  a(); b(); c();
});

test("m: common props given by hand to a component go to its root elements (the m: built-in), not to its props", async () => {
  const P = await import("../src/props/index.ts");
  let got;
  function Box(p) { got = Object.keys(p); return h("div", { class: "box" }); }
  const { host, dispose } = mount(() => h(Box, { "m:test": "save", a: 1 }));
  assert.deepEqual(got, ["a"]);
  assert.equal(host.querySelector(".box").getAttribute("data-testid"), "save");
  dispose();
  assert.ok(P.registerMProp);
});

test("bench: nothing registered (and everything removed again) costs nothing; extensions for other components almost nothing", async () => {
  const { extensionBench } = await import("../bench/extensions.js");
  const r = await extensionBench(3000, 5);
  assert.ok(r.after < r.none * 1.6, `after removal ${r.after.toFixed(1)} ms vs ${r.none.toFixed(1)} ms`);
  assert.ok(r.twentyOther < r.none * 1.6, `20 for other components ${r.twentyOther.toFixed(1)} ms vs ${r.none.toFixed(1)} ms`);
  assert.ok(r.one < r.none * 6, `one extension ${r.one.toFixed(1)} ms vs ${r.none.toFixed(1)} ms`);
});

test("extensions.name: components named by their export names (minified builds), for test targets and tools", () => {
  const f = function f() { return h("u", { class: "minified" }); };
  extensions.name({ Underline: f, lower: () => null });
  const off = intercept({ test: (c, info) => info.name === "Underline" }, { name: "by-export", render: () => h("b", null, "named") });
  const { host, dispose } = mount(() => h(f, {}));
  assert.equal(host.querySelector("b").textContent, "named");
  assert.equal(extensions.list().find((r) => r.name === "by-export").target, "test");
  dispose(); off();
});

test("partial targets: partOf(Button, Spinner) reaches Button's own Spinner; inside(Button, Spinner) also the one in a Card inside it; a Spinner outside is never touched", () => {
  const { lazyChildren, inside, partOf } = M;
  function Spinner(p) { return h("i", { class: "spin", "data-size": () => p.size ?? "md" }); }
  function PButton(p) { return h("button", { class: "pb" }, h(Spinner, {}), () => p.children); }
  function PCard(p) { return h("div", { class: "pc" }, () => p.children); }
  const show = signal(false);
  const tree = () => [
    h("section", { id: "own" }, h(PButton, {})),
    h("section", { id: "deep" }, h(PButton, {}, lazyChildren(() => [h(PCard, {}, lazyChildren(() => [h(Spinner, {})]))]))),
    h("section", { id: "late" }, h(PButton, {}, lazyChildren(() => [h(PCard, {}, lazyChildren(() => [() => (show() ? h(Spinner, {}) : null)]))]))),
    h("section", { id: "out" }, h(Spinner, {}), h(PCard, {}, lazyChildren(() => [h(Spinner, {})]))),
  ];
  const sizes = (host, id) => [...host.querySelectorAll(`#${id} .spin`)].map((x) => x.getAttribute("data-size"));

  let off = intercept(partOf(PButton, Spinner), { name: "own-spinner", props: () => ({ size: "em" }) });
  let r = mount(tree);
  assert.deepEqual(sizes(r.host, "own"), ["em"], "Button's own Spinner");
  assert.deepEqual(sizes(r.host, "deep"), ["em", "md"], "the Spinner in a Card inside the Button is not its own part");
  assert.deepEqual(sizes(r.host, "out"), ["md", "md"], "outside: untouched");
  r.dispose(); off();

  off = intercept(inside(PButton, Spinner), { name: "any-spinner", props: () => ({ size: "xs" }) });
  r = mount(tree);
  assert.deepEqual(sizes(r.host, "deep"), ["xs", "xs"], "any depth inside the Button");
  assert.deepEqual(sizes(r.host, "out"), ["md", "md"]);
  show.set(true);
  assert.deepEqual(sizes(r.host, "late"), ["xs", "xs"], "a Spinner drawn later inside is reached too");
  assert.equal(extensions.list().find((x) => x.name === "any-spinner").target, "inside(PButton, Spinner)");
  r.dispose(); off(); show.set(false);

  // a chain, lists, "*", m:extend, a test that reads the path, a scope; cleanup with the instance
  const log = [];
  const offs = [
    intercept(inside(PButton, PCard, Spinner), { name: "chain", props: () => ({ size: "chain" }) }),
    extend(partOf([PCard, PButton], "*"), { name: "star", setup: ({ onCleanup }) => { log.push("up"); onCleanup(() => log.push("down")); } }),
  ];
  r = mount(tree);
  assert.deepEqual(sizes(r.host, "own"), ["md"]);
  assert.deepEqual(sizes(r.host, "deep"), ["md", "chain"]);
  assert.deepEqual(sizes(r.host, "out"), ["md", "md"], "a Card outside a Button is not the chain");
  const ups = log.length;
  assert.ok(ups >= 4, `parts of a Card or a Button: ${ups}`);
  r.dispose();
  assert.equal(log.filter((x) => x === "down").length, ups, "every setup cleaned up with its instance");
  for (const o of offs) o();

  const seen = [];
  const offT = intercept({ test: (c, info, path) => { if (c === Spinner) seen.push(path.map((x) => x.name).join(">")); return false; } }, { name: "peek" });
  r = mount(tree);
  assert.ok(seen.includes("PButton>PCard"), seen.join(" | "));
  assert.ok(seen.includes(""), "a Spinner at the top has an empty path");
  r.dispose(); offT();

  r = mount(() => withExtensions([[partOf(PButton, Spinner), defineExtension({ name: "scoped", props: () => ({ size: "sc" }) })]], () => [h(PButton, {}), h(Spinner, {})]));
  assert.deepEqual([...r.host.querySelectorAll(".spin")].map((x) => x.getAttribute("data-size")), ["sc", "md"]);
  r.dispose();
  assert.throws(() => intercept(inside(PButton, "*"), { name: "x", render: (n) => n() }), /only adds props/);
  assert.throws(() => inside(PButton), /two steps/);
});

test("intercept props: a prop the instance is given stays live, so an interceptor that returns it only later (it read a signal that was off) still changes it", async () => {
  const { Button } = await import("../src/ui/index.ts");
  const on = M.signal(false);
  const off = M.intercept(Button, { name: "later", props: (p) => (on() && String(p.class ?? "").includes("t") ? { variant: "primary" } : null) });
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = M.render(() => M.h(Button, { class: "t", variant: "ghost" }, "A"), el);
  const btn = el.querySelector("button");
  assert.match(btn.className, /m-btn-ghost/);
  on.set(true);
  assert.match(btn.className, /m-btn-primary/, "the later return reaches the component");
  on.set(false);
  assert.match(btn.className, /m-btn-ghost/, "and goes back");
  dispose(); off();
});
