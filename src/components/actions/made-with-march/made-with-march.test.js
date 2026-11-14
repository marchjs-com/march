import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { render } = await import("../../../index.ts");
const { h } = await import("../../../index.ts");
const { MadeWithMarch, MARCH_URL } = await import("./index.ts");
const { messages, setLocale } = await import("../../../core/i18n.ts");
const { default: tr } = await import("../../../i18n/tr.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("MadeWithMarch: sentence, link from the constant, accessible heart, variants", () => {
  const m = mount(() => [h(MadeWithMarch, {}), h(MadeWithMarch, { variant: "badge" }), h(MadeWithMarch, { variant: "small" })]);
  const [a, b, c] = m.el.querySelectorAll(".hm-madewith");
  assert.equal(a.textContent, "Developed with March and 💗");
  assert.ok(a.className.includes("hm-madewith-text") && b.className.includes("hm-madewith-badge") && c.className.includes("hm-madewith-small"));
  const link = a.querySelector("a");
  assert.equal(link.getAttribute("href"), MARCH_URL);
  assert.equal(link.textContent, "March");
  assert.ok(link.getAttribute("rel").includes("noopener"));
  const heart = a.querySelector("[role=img]");
  assert.equal(heart.textContent, "💗");
  assert.ok(heart.getAttribute("aria-label"));
  m.dispose();
});

test("MadeWithMarch: the heart, the link and the sentence are yours", async () => {
  await setLocale("en");
  const m = mount(() => [
    h(MadeWithMarch, { heart: false }),
    h(MadeWithMarch, { heart: "☕", heartLabel: "Coffee", link: "March UI", href: "https://example.com/march" }),
    h(MadeWithMarch, { text: (link, heart) => ["Built on ", link, " ", heart] }),
    h(MadeWithMarch, { heart: false, text: (link, heart) => [link, String(heart)] }),
  ]);
  const [a, b, c, d] = m.el.querySelectorAll(".hm-madewith");
  assert.equal(a.textContent, "Developed with March");
  assert.equal(a.querySelector("[role=img]"), null);
  assert.equal(b.textContent, "Developed with March UI and ☕");
  assert.equal(b.querySelector("[role=img]").getAttribute("aria-label"), "Coffee");
  assert.equal(b.querySelector("a").getAttribute("href"), "https://example.com/march");
  assert.equal(c.textContent, "Built on March 💗");
  assert.equal(d.textContent, "Marchnull");
  m.dispose();
});

test("MadeWithMarch: Turkish word order", async () => {
  messages("tr", tr);
  await setLocale("tr");
  const m = mount(() => h(MadeWithMarch, {}));
  assert.equal(m.el.querySelector(".hm-madewith").textContent, "March ve 💗 ile geliştirildi");
  assert.equal(m.el.querySelector("[role=img]").getAttribute("aria-label"), "Sevgi");
  m.dispose();
  const n = mount(() => h(MadeWithMarch, { heart: false }));
  assert.equal(n.el.querySelector(".hm-madewith").textContent, "March ile geliştirildi");
  n.dispose();
  await setLocale("en");
});
