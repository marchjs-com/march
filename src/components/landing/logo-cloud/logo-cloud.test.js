import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { LogoCloud } = await import("./index.ts");

const logos = [{ name: "HADİ", src: "/a.svg", width: 120, height: 32 }, { name: "Orbit", node: h("svg", {}) }];
const mount = (props) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(() => h(LogoCloud, props), el); return { el, dispose }; };

test("LogoCloud grid: one cell per logo, alt text, reserved size, lazy", () => {
  const { el, dispose } = mount({ logos, title: "Trusted by" });
  assert.equal(el.querySelectorAll(".m-logos-cell").length, 2);
  const img = el.querySelector("img.m-logo-img");
  assert.equal(img.getAttribute("alt"), "HADİ");
  assert.equal(img.getAttribute("width"), "120");
  assert.equal(img.getAttribute("loading"), "lazy");
  assert.equal(el.querySelector(".m-logos-title").textContent, "Trusted by");
  dispose();
});

test("LogoCloud marquee: inside a Marquee, the second copy is hidden from screen readers", () => {
  const { el, dispose } = mount({ logos, variant: "marquee" });
  assert.ok(el.querySelector(".m-marquee .m-logos-row"));
  assert.equal(el.querySelectorAll(".m-marquee-unit")[1].getAttribute("aria-hidden"), "true");
  assert.ok(el.querySelector(".m-logos").className.includes("is-mono"));
  dispose();
});

test("LogoCloud grid: the entrance can be switched off", () => {
  const a = mount({ logos });
  assert.ok(a.el.querySelector(".m-logos").classList.contains("m-reveal"), "the default entrance");
  a.dispose();
  const b = mount({ logos, reveal: "none", class: "mine" });
  assert.equal(b.el.querySelector(".m-logos.mine").classList.contains("m-reveal"), false);
  assert.equal(b.el.querySelector(".m-reveal-item"), null, "no cell waits hidden");
  b.dispose();
});
