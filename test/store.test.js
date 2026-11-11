import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.js";
installDom();
const { batch, effect, h, render } = await import("../src/index.js");
const { store, patch, subscribe, on, derive, snapshot, readonly, persist, history, storeLog } = await import("../src/store/index.ts");

test("plain writes, fine-grained tracking, array methods", () => {
  const app = store({ user: { name: "Ada", age: 36 }, cart: { items: [] } });
  const names = [];
  effect(() => names.push(app.user.name));
  app.user.age = 37;
  app.user.name = "Ece";
  assert.deepEqual(names, ["Ada", "Ece"], "age change did not re-run the name effect");
  const count = derive(() => app.cart.items.length);
  app.cart.items.push({ id: 1 }, { id: 2 });
  assert.equal(count(), 2);
  app.cart.items.splice(0, 1);
  assert.equal(count(), 1);
  const el = document.createElement("div");
  render(() => h("b", {}, () => app.user.name), el);
  app.user.name = "Grace";
  assert.equal(el.textContent, "Grace");
});

test("subscribe/on: events with path, op, value, old; wildcards; batch groups", () => {
  const app = store({ users: [{ name: "a" }, { name: "b" }], flags: { beta: true }, cart: { items: [] } });
  const all = [], names = [], items = [];
  subscribe(app, (e) => all.push(e));
  on(app, "users.*.name", (e) => names.push(e));
  on(app.cart, "items", (e) => items.push(e.op));
  app.users[1].name = "B";
  delete app.flags.beta;
  app.cart.items.push(1);
  assert.deepEqual(names.map((e) => [e.path, e.op, e.value, e.old]), [["users.1.name", "set", "B", "b"]]);
  assert.deepEqual(all.map((e) => e.op), ["set", "delete", "push"]);
  assert.deepEqual(items, ["push"]);
  all.length = 0;
  batch(() => { app.users[0].name = "A"; app.cart.items.push(2); });
  assert.equal(all.length, 1);
  assert.equal(all[0].op, "batch");
  assert.deepEqual(all[0].changes.map((c) => c.path), ["users.0.name", "cart.items"]);
  assert.ok(storeLog(app).length >= 4);
});

test("snapshot is frozen; readonly throws on write; patch deep-merges", () => {
  const app = store({ a: { b: 1, c: [1] } });
  const snap = snapshot(app);
  assert.ok(Object.isFrozen(snap.a));
  app.a.b = 2;
  assert.equal(snap.a.b, 1);
  const ro = readonly(app);
  assert.equal(ro.a.b, 2);
  assert.throws(() => { ro.a.b = 3; }, /read-only/);
  patch(app, { a: { c: [9] } });
  assert.deepEqual(snapshot(app), { a: { b: 2, c: [9] } });
});

test("persist loads and saves (debounced); history undo/redo", async () => {
  localStorage.setItem("prefs", JSON.stringify({ theme: "dark" }));
  const app = store({ prefs: { theme: "light", size: 1 } });
  const stop = persist(app.prefs, "prefs", { delay: 5 });
  assert.equal(app.prefs.theme, "dark");
  app.prefs.size = 2;
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(JSON.parse(localStorage.getItem("prefs")), { theme: "dark", size: 2 });
  stop();
  const form = store({ title: "a", tags: [] });
  const hist = history(form);
  form.title = "b";
  form.tags.push("x");
  assert.equal(hist.canUndo(), true);
  hist.undo();
  assert.deepEqual(snapshot(form), { title: "b", tags: [] });
  hist.undo();
  assert.equal(form.title, "a");
  assert.equal(hist.canUndo(), false);
  hist.redo();
  assert.equal(form.title, "b");
});
