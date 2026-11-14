import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ThemeMenu } = await import("./index.ts");
const U = await import("../../../ui/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const panel = () => document.querySelector(".m-theme-menu");

test("ThemeMenu: one panel with appearance, themes and accents; sections follow the props; choices apply", async () => {
  const m = mount(() => [h(ThemeMenu, {}), h(ThemeMenu, { themes: false, accents: ["primary", "brand-blue"], class: "two" })]);
  m.el.querySelector("button").click(); await tick();
  assert.ok(panel().querySelector(".m-theme-modes [role=radio]"));
  assert.ok(panel().querySelector(".m-theme-list [role=radio]"), "color themes");
  assert.equal(panel().querySelectorAll(".m-accent-list [role=radio]").length, U.ACCENT_CHOICES.length);
  [...panel().querySelectorAll(".m-theme-modes [role=radio]")][1].click();
  assert.equal(U.theme(), "dark");
  [...panel().querySelectorAll(".m-accent-list [role=radio]")].find((b) => b.getAttribute("aria-checked") === "false").click();
  assert.notEqual(U.accent(), "primary");
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
  m.el.querySelector(".two").click(); await tick();
  const p = [...document.querySelectorAll(".m-theme-menu")].at(-1);
  assert.equal(p.querySelector(".m-theme-list"), null, "themes={false}");
  assert.equal(p.querySelectorAll(".m-accent-list [role=radio]").length, 2);
  U.setAccent("primary"); U.setTheme("system");
  m.dispose();
});

test("ThemeMenu: icon, modes, headings and heading texts are yours", async () => {
  const m = mount(() => [h(ThemeMenu, { class: "a", labels: { theme: "Palette", accent: () => "Highlight" }, panelClass: "mine" }), h(ThemeMenu, { class: "b", icon: false, modes: false, headings: false })]);
  assert.ok(m.el.querySelector(".a svg"), "palette icon by default");
  assert.equal(m.el.querySelector(".b svg"), null, "icon={false}: text only");
  m.el.querySelector(".a").click(); await tick();
  let p = [...document.querySelectorAll(".m-theme-menu")].at(-1);
  assert.ok(p.classList.contains("mine"));
  assert.deepEqual([...p.querySelectorAll(".m-theme-menu-heading")].map((x) => x.textContent), ["Palette", "Highlight"]);
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
  m.el.querySelector(".b").click(); await tick();
  p = [...document.querySelectorAll(".m-theme-menu")].at(-1);
  assert.equal(p.querySelector(".m-theme-modes"), null, "modes={false}");
  assert.equal(p.querySelector(".m-theme-menu-heading"), null, "headings={false}");
  assert.ok(p.querySelector(".m-theme-list"));
  m.dispose();
});
