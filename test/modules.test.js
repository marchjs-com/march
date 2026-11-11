import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.js";
installDom({ url: "http://localhost/" });
const { signal, h, render, effect, createRoot } = await import("../src/index.js");
const R = await import("../src/router/index.js");
const D = await import("../src/data/index.js");
const { schema } = await import("../src/schema/index.js");
const A = await import("../src/access/index.js");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test("router: matching, params, query, lazy pages, guards, Link, setQuery", async () => {
  assert.deepEqual(R.matchRoute([R.compilePath("/users/:id")], "/users/42").params, { id: "42" });
  assert.equal(R.matchRoute([R.compilePath("/a/*rest")], "/a/b/c").params.rest, "b/c");
  const Home = () => h("h1", {}, "home");
  const User = (p) => h("h1", {}, `user ${p.params.id}`);
  R.createRouter({ routes: { "/": { component: Home }, "/users/:id": () => Promise.resolve({ default: User }), "/secret": { component: Home, meta: {} }, "/admin": () => Promise.resolve({ default: Home, guard: () => "/" }) } });
  const el = document.createElement("div");
  render(() => [h(R.Link, { href: "/users/7" }, "go"), h(R.Router, {})], el);
  await tick();
  assert.equal(el.querySelector("h1").textContent, "home");
  el.querySelector("a").click();
  await tick(); await tick();
  assert.equal(location.pathname, "/users/7");
  assert.equal(el.querySelector("h1").textContent, "user 7");
  assert.equal(el.querySelector("a").getAttribute("aria-current"), "page");
  assert.equal(R.params().id, "7");
  await R.setQuery({ tab: "info", empty: "" });
  assert.equal(location.search, "?tab=info");
  assert.equal(R.query().tab, "info");
  await R.navigate("/admin");
  await tick();
  assert.equal(location.pathname, "/", "guard redirected");
  await R.navigate("/nope");
  assert.equal(el.textContent.includes("Not found"), true);
  assert.throws(() => R.navigate("https://evil.example/"), /same-origin/);
  R._resetRouter();
});

test("query: loads, caches by key, dedupes, refetches on key change, retries transient errors", async () => {
  let calls = 0;
  const page = signal(1);
  const fetcher = async ({ signal: s }) => { calls++; await tick(1); if (s.aborted) throw Object.assign(new Error("a"), { name: "AbortError" }); return `p${page.peek()}`; };
  let q1, q2;
  createRoot(() => { q1 = D.query(fetcher, { key: () => ["items", page()] }); q2 = D.query(fetcher, { key: () => ["items", page()] }); });
  assert.equal(q1.loading(), true);
  await tick(5);
  assert.equal(q1(), "p1"); assert.equal(q2(), "p1");
  assert.equal(calls, 1, "deduped");
  page.set(2);
  await tick(5);
  assert.equal(q1(), "p2");
  D.configure({ retryDelay: 1 });
  let n = 0;
  let q3;
  createRoot(() => { q3 = D.query(async () => { n++; if (n < 3) throw Object.assign(new Error("down"), { status: 503 }); return "ok"; }, { key: "flaky" }); });
  await tick(30);
  assert.equal(q3(), "ok"); assert.equal(n, 3);
  let m = 0, q4;
  createRoot(() => { q4 = D.query(async () => { m++; throw Object.assign(new Error("no"), { status: 403 }); }, { key: "forbidden" }); });
  await tick(10);
  assert.equal(q4.error().message, "no"); assert.equal(m, 1, "4xx not retried");
});

test("query without key tracks signals read before the first await", async () => {
  const id = signal("a");
  const seen = [];
  let q;
  createRoot(() => { q = D.query(async () => { const v = id(); seen.push(v); await tick(1); return v.toUpperCase(); }); });
  await tick(5);
  assert.equal(q(), "A");
  id.set("b");
  await tick(5);
  assert.equal(q(), "B");
  assert.deepEqual(seen, ["a", "b"]);
});

test("mutation: invalidates queries, optimistic undo on error", async () => {
  let v = 1, q;
  createRoot(() => { q = D.query(async () => v, { key: ["counter"] }); });
  await tick(2);
  const inc = D.mutation(async () => { v++; }, { invalidates: ["counter"] });
  await inc();
  await tick(2);
  assert.equal(q(), 2);
  const fail = D.mutation(async () => { throw new Error("x"); }, { optimistic: () => { q.mutate(99); return () => q.mutate(2); } });
  await assert.rejects(fail());
  assert.equal(q(), 2);
  assert.equal(fail.error().message, "x");
});

test("schema: validate, coerce, defaults, columns, conditional fields", () => {
  const S = schema({
    title: { type: "text", required: true, max: 5 },
    price: { type: "money", currency: "EUR", min: 0 },
    status: { type: "pick", options: ["draft", "live"], default: "draft" },
    tags: "list",
    note: { type: "text", required: true, when: (v) => v.status === "live" },
    data: "json",
  });
  assert.deepEqual(S.defaults(), { title: "", price: null, status: "draft", tags: [], note: "", data: null });
  const r = S.validate({ title: "toolong", price: "-1", status: "draft", data: "{bad" });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["data", "price", "title"]);
  assert.equal(S.validate({ title: "ok", price: "12,5", status: "live", note: "" }).errors.note, "This field is required");
  assert.deepEqual(S.parse({ price: "1.234,50", tags: "a, b\nc" }), { price: 1234.5, tags: ["a", "b", "c"] });
  const cols = S.columns();
  assert.deepEqual(cols.find((c) => c.key === "price").format, ["money", "EUR"]);
  assert.equal(cols.find((c) => c.key === "status").filter, "select");
  assert.equal(S.pick("title").fields.length, 1);
  assert.throws(() => schema({ x: "nope" }), /unknown field type/);
});

test("access: can/role/method gate", () => {
  A.setAccess(null);
  assert.equal(A.can("x"), false);
  assert.equal(A.denied({ perm: "x" }), "auth");
  A.setAccess({ user: { id: 1 }, roles: ["reviewer"], perms: ["plugins.review"], methods: ["sso"] });
  assert.equal(A.can("plugins.review"), true);
  assert.equal(A.can(["a", "plugins.review"]), true);
  assert.equal(A.role(), "reviewer");
  assert.equal(A.denied({ method: "phone" }), "method");
  const el = document.createElement("div");
  render(() => h(A.Gate, { method: "phone", fallback: (why) => `need ${why}` }, "secret"), el);
  assert.equal(el.textContent, "need method");
  A.setAccess({ user: { id: 1 }, methods: ["phone"], perms: ["*"] });
  assert.equal(el.textContent, "secret");
  assert.equal(A.can("anything"), true);
});
