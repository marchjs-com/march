import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { AppShell } = await import("./index.ts");

test("AppShell: skip link to main, sidebar, banner and header slots", () => {
  const { host, dispose } = mount(() => h(AppShell, { nav: "NAV", top: "TOP", header: "HEAD", mainId: "m1" }, "PAGE"));
  const shell = host.querySelector(".m-shell");
  assert.match(shell.getAttribute("class"), /m-shell-has-header/);
  assert.equal(host.querySelector(".m-skip").getAttribute("href"), "#m1");
  assert.equal(host.querySelector("aside.m-shell-nav").textContent, "NAV");
  assert.equal(host.querySelector(".m-shell-top").textContent, "TOP");
  assert.equal(host.querySelector("header.m-shell-header").textContent, "HEAD");
  const main = host.querySelector("main");
  assert.equal(main.id, "m1");
  assert.equal(main.textContent, "PAGE");
  dispose();
  const b = mount(() => h(AppShell, {}, "x"));
  assert.equal(b.host.querySelector(".m-shell-top"), null);
  assert.equal(b.host.querySelector("main").id, "main");
  b.dispose();
});

test("AppShell: the skip link text is yours, or the link is off", () => {
  const a = mount(() => h(AppShell, { features: [], labels: { skip: "Jump" }, class: "mine" }, "x"));
  assert.equal(a.host.querySelector(".m-skip").textContent, "Jump");
  assert.match(a.host.querySelector(".m-shell").getAttribute("class"), /mine/);
  a.dispose();
  const b = mount(() => h(AppShell, { features: [], skipLink: false }, "x"));
  assert.equal(b.host.querySelector(".m-skip"), null);
  assert.ok(b.host.querySelector("main"));
  b.dispose();
});
