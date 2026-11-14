import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Newsletter } = await import("./index.ts");

const tick = () => new Promise((r) => setTimeout(r, 0));
const type = (input, v) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); };

test("Newsletter: invalid address shows an alert, valid one calls onSubmit and shows the status line", async () => {
  const sent = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Newsletter, { title: "News", onSubmit: (e) => { sent.push(e); } }), el);
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("aria-label"), "Email address");
  type(input, "nope");
  el.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(el.querySelector(".hm-input-error").textContent, "Enter a valid email address.");
  assert.equal(sent.length, 0);
  type(el.querySelector("input"), "ada@example.com");
  el.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 450));
  assert.deepEqual(sent, ["ada@example.com"]);
  assert.equal(el.querySelector(".hm-nl-done").getAttribute("role"), "status");
  assert.equal(el.querySelector("form"), null);
  dispose();
});

test("Newsletter: a rejected submit shows its message", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Newsletter, { onSubmit: () => Promise.reject(new Error("Taken")) }), el);
  type(el.querySelector("input"), "a@b.io");
  el.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(el.querySelector(".hm-input-error").textContent, "Taken");
  dispose();
});

test("Newsletter: own texts, own done mark or none, no motion", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [
    h(Newsletter, { class: "a", onSubmit: () => {}, motion: false, doneIcon: h("i", { class: "mine" }), labels: { email: "Mail", invalid: "Bad" } }),
    h(Newsletter, { class: "b", onSubmit: () => Promise.reject(new Error("")), motion: false, doneIcon: false, labels: { error: "Failed" } }),
    h(Newsletter, { class: "c", onSubmit: () => {}, motion: false, doneIcon: false }),
  ], el);
  const send = (root, v) => { type(root.querySelector("input"), v); root.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); };
  const [a, b, c] = ["a", "b", "c"].map((k) => el.querySelector(`.hm-nl.${k}`));
  assert.equal(a.querySelector("input").getAttribute("aria-label"), "Mail");
  send(a, "nope");
  assert.equal(a.querySelector(".hm-input-error").textContent, "Bad");
  send(a, "ada@example.com"); send(b, "ada@example.com"); send(c, "ada@example.com");
  for (let i = 0; i < 5; i++) await tick();
  assert.ok(a.querySelector(".hm-nl-done .hm-nl-check .mine"), "done at once (no fold), with the own mark");
  assert.equal(b.querySelector(".hm-input-error").textContent, "Failed");
  assert.ok(c.querySelector(".hm-nl-done"));
  assert.equal(c.querySelector(".hm-nl-check"), null);
  dispose();
});
