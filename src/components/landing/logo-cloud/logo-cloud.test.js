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
  assert.equal(el.querySelectorAll(".hm-logos-cell").length, 2);
  const img = el.querySelector("img.hm-logo-img");
  assert.equal(img.getAttribute("alt"), "HADİ");
  assert.equal(img.getAttribute("width"), "120");
  assert.equal(img.getAttribute("loading"), "lazy");
  assert.equal(el.querySelector(".hm-logos-title").textContent, "Trusted by");
  dispose();
});

test("LogoCloud marquee: inside a Marquee, the second copy is hidden from screen readers", () => {
  const { el, dispose } = mount({ logos, variant: "marquee" });
  assert.ok(el.querySelector(".hm-marquee .hm-logos-row"));
  assert.equal(el.querySelectorAll(".hm-marquee-unit")[1].getAttribute("aria-hidden"), "true");
  assert.ok(el.querySelector(".hm-logos").className.includes("is-mono"));
  dispose();
});

test("LogoCloud grid: the entrance can be switched off", () => {
  const a = mount({ logos });
  assert.ok(a.el.querySelector(".hm-logos").classList.contains("hm-reveal"), "the default entrance");
  a.dispose();
  const b = mount({ logos, reveal: "none", class: "mine" });
  assert.equal(b.el.querySelector(".hm-logos.mine").classList.contains("hm-reveal"), false);
  assert.equal(b.el.querySelector(".hm-reveal-item"), null, "no cell waits hidden");
  b.dispose();
});
