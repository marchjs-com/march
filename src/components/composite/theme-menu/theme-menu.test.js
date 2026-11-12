import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ThemeMenu } = await import("./index.ts");
const U = await import("../../../ui/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const panel = () => document.querySelector(".hm-theme-menu");

test("ThemeMenu: one panel with appearance, themes and accents; sections follow the props; choices apply", async () => {
  const m = mount(() => [h(ThemeMenu, {}), h(ThemeMenu, { themes: false, accents: ["primary", "brand-blue"], class: "two" })]);
  m.el.querySelector("button").click(); await tick();
  assert.ok(panel().querySelector(".hm-theme-modes [aria-pressed]"));
  assert.ok(panel().querySelector(".hm-theme-list [role=radio]"), "color themes");
  assert.equal(panel().querySelectorAll(".hm-accent-list [role=radio]").length, U.ACCENT_CHOICES.length);
  [...panel().querySelectorAll(".hm-theme-mode")][1].click();
  assert.equal(U.theme(), "dark");
  [...panel().querySelectorAll(".hm-accent-opt")].find((b) => b.getAttribute("aria-checked") === "false").click();
  assert.notEqual(U.accent(), "primary");
  document.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
  m.el.querySelector(".two").click(); await tick();
  const p = [...document.querySelectorAll(".hm-theme-menu")].at(-1);
  assert.equal(p.querySelector(".hm-theme-list"), null, "themes={false}");
  assert.equal(p.querySelectorAll(".hm-accent-list [role=radio]").length, 2);
  U.setAccent("primary"); U.setTheme("system");
  m.dispose();
});
