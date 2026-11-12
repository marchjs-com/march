import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, serialize } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose, html: () => serialize(el) }; };
const input = { source: 'const a = "x" // hi', lang: "tsx" };

test("code-view point: CodeViewer is the default, with Copy and Fullscreen as separate actions", () => {
  const m = mount(() => h(U.Widget, { sources: [U.codeView], input }));
  const w = m.el.querySelector(".hm-widget");
  assert.equal(w.getAttribute("data-widget"), "viewer");
  assert.ok(m.el.querySelector(".hm-code"));
  assert.equal(m.el.querySelector(".hm-tok-kw").textContent, "const");
  assert.equal(m.el.querySelector(".hm-tok-str").textContent, '"x"');
  assert.equal(m.el.querySelector(".hm-tok-com").textContent, "// hi");
  assert.equal(m.el.querySelectorAll(".hm-copy").length, 1, "one Copy (from the action, not CodeView's own)");
  assert.ok([...m.el.querySelectorAll("button")].some((b) => b.getAttribute("aria-haspopup") === "dialog"), "Fullscreen action");
  m.dispose();
});

test("the input is live: a changed input draws the provider again (a library picker over one Code card)", async () => {
  const { signal, reactive } = await import("../src/index.ts");
  const lib = signal("march");
  const SOURCES = { march: "const march = 1", vanilla: "let vanilla = 2", svelte: "<p>{svelte}</p>" };
  const m = mount(() => h(U.Widget, { sources: [U.codeView], input: reactive(() => ({ source: SOURCES[lib()], lang: lib() === "svelte" ? "html" : "tsx" })) }));
  // (what the compiler writes for input={{ source: SOURCES[$lib], … }})
  assert.match(m.el.querySelector(".hm-code").textContent, /const march = 1/);
  lib.set("vanilla");
  await tick();
  assert.match(m.el.querySelector(".hm-code").textContent, /let vanilla = 2/, "the code follows the input");
  assert.equal(m.el.querySelectorAll(".hm-widget").length, 1, "same widget, its content redrawn");
  lib.set("svelte");
  await tick();
  assert.match(m.el.querySelector(".hm-code").textContent, /<p>\{svelte\}<\/p>/);
  assert.equal(m.el.querySelectorAll(".hm-copy").length, 1, "one Copy action for the current input");
  m.dispose();
});

test("a second provider registered later replaces CodeViewer in every Code tab; removing it brings the viewer back", async () => {
  const a = mount(() => h(U.Widget, { sources: [U.codeView], input }));
  const b = mount(() => h(U.Widget, { sources: [U.codeView], input: { ...input, lang: "css", source: "a { color: red; }" } }));
  const off = U.codeView.provide({ id: "fake-editor", render: (i, ctx) => h("div", { class: "fake" }, i.source, ctx.actions()) });
  await tick();
  for (const m of [a, b]) {
    assert.equal(m.el.querySelector(".hm-widget").getAttribute("data-widget"), "fake-editor");
    assert.ok(m.el.querySelector(".fake"));
    assert.equal(m.el.querySelector(".hm-code"), null);
    assert.ok(m.el.querySelector(".fake .hm-copy"), "actions are offered to the new provider too");
  }
  off();
  await tick();
  assert.equal(a.el.querySelector(".hm-widget").getAttribute("data-widget"), "viewer");
  assert.ok(a.el.querySelector(".hm-code"));
  a.dispose(); b.dispose();
});

test("widget points: same id gives the same point; order and when pick the main provider", () => {
  const p = U.widgetPoint("t-point", { defaults: [{ id: "d", render: () => "d" }] });
  assert.equal(U.widgetPoint("t-point"), p);
  const off1 = p.provide({ id: "low", order: -1, render: () => "low" });
  assert.equal(U.pickMain([p], {}).id, "d");
  const off2 = p.provide({ id: "only-json", order: 5, when: (i) => i.lang === "json", render: () => "j" });
  assert.equal(U.pickMain([p], { lang: "tsx" }).id, "d");
  assert.equal(U.pickMain([p], { lang: "json" }).id, "only-json");
  off1(); off2();
  assert.deepEqual(p.providers().map((x) => x.id), ["d"]);
});

test("CodeViewer: multi-file switcher and fullscreen dialog without a second Fullscreen button", async () => {
  const m = mount(() => h(U.Widget, { sources: [U.codeView], input: { ...input, files: [{ name: "a.css", lang: "css", source: "a { color: red }" }] } }));
  const files = m.el.querySelectorAll(".hm-code-files button");
  assert.equal(files.length, 2);
  files[1].click();
  assert.equal(m.el.querySelector(".hm-code-lang").textContent, "css");
  assert.equal(m.el.querySelector(".hm-tok-attr").textContent, "color");
  const full = [...m.el.querySelectorAll("button")].find((b) => b.getAttribute("aria-haspopup") === "dialog");
  full.click();
  await tick();
  const dlg = document.body.querySelector(".hm-code-full");
  assert.ok(dlg, "fullscreen dialog");
  assert.ok(dlg.querySelector(".hm-code-widget.is-expanded"));
  assert.equal([...dlg.querySelectorAll("button")].filter((b) => b.getAttribute("aria-haspopup") === "dialog").length, 0);
  U.closeAll();
  m.dispose();
});

test("tokenize: untrusted text stays text; unknown languages stay plain", () => {
  const evil = '<img src=x onerror="alert(1)">';
  const m = mount(() => h(U.CodeView, { code: evil, lang: "html" }));
  assert.equal(m.el.querySelector("img"), null);
  assert.equal(m.el.querySelector(".hm-code-text").textContent, evil);
  assert.ok(m.el.querySelector(".hm-tok-tag"));
  m.dispose();
  assert.deepEqual(U.tokenize("a < b", "text"), [["", "a < b"]]);
  assert.deepEqual(U.tokenize("x-1", "ts").map((t) => t[0]), ["", "punct", "num"]);
  assert.deepEqual(U.tokenLines("/* a\nb */ x", "js").map((l) => l.map((t) => t[0])), [["com"], ["com", ""]]);
});
