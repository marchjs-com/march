// The common m: props beyond no-select and parts: m:color, m:dir, m:lang, m:test, m:theme (attributes), m:can (hide or
// disable), m:tip (a hint without a wrapper), m:reveal (entrance once in view): compiler output and runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, M_TEXT } from "../compiler/index.js";
import { installDom, Event } from "../src/testing/dom.ts";

const RT = new URL("../src/index.ts", import.meta.url).href;
const PROPS = new URL("../src/props/index.ts", import.meta.url).href;
const c = (src, o = {}) => compile(src, { runtime: RT, props: PROPS, ...o }).code;
const { document } = installDom();
const P = await import("../src/props/index.ts");
const { createRoot } = await import("../src/core/reactive.ts");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test("compiler: a text constant on a native element is its attribute; on a component, or live, it goes through mProps()", () => {
  assert.deepEqual(M_TEXT, { color: "data-m-color", dir: "dir", lang: "lang", test: "data-testid", theme: "data-m-theme" });
  const out = c('const a = <div m:color="brand-blue" m:dir="rtl" m:lang="ar" m:test="save">x</div>');
  for (const [k, v] of [["data-m-color", "brand-blue"], ["dir", "rtl"], ["lang", "ar"], ["data-testid", "save"]]) assert.match(out, new RegExp(`\\["${k}","${v}"\\]`));
  assert.doesNotMatch(out, /mProps/, "no runtime for constants on native elements");
  // the theme needs its stylesheet loaded: runtime
  assert.match(c('const a = <div m:theme="night">x</div>'), /_\$m\(.*\{"theme": "night"\}\)/);
  assert.match(c('const a = <Card m:color="brand-blue" />'), /_\$m\(_\$h\(Card.*\{"color": "brand-blue"\}\)/);
  assert.match(c('let $c = "info"\nconst a = <div m:color={$c}>x</div>'), /"color": \(\) => \(\$c\(\)\)/);
  assert.match(c('const a = <button m:tip="Copy" m:reveal m:can={ok}>x</button>'), /"tip": "Copy", "reveal": true, "can": ok/);
});

test("runtime: the attribute props set, change and remove their attribute (live values follow)", () => {
  const el = document.createElement("div");
  P.mProps(el, { color: "brand-blue", dir: "rtl", lang: "ar", test: "save", theme: "night" });
  assert.equal(el.getAttribute("data-m-color"), "brand-blue");
  assert.equal(el.getAttribute("dir"), "rtl");
  assert.equal(el.getAttribute("lang"), "ar");
  assert.equal(el.getAttribute("data-testid"), "save");
  assert.equal(el.getAttribute("data-m-theme"), "night");
  P.mProps(el, { color: null, dir: undefined, test: false });
  assert.equal(el.hasAttribute("data-m-color"), false);
  assert.equal(el.hasAttribute("dir"), false);
  assert.equal(el.hasAttribute("data-testid"), false);
});

test("runtime m:can: false hides; { allow: false, else: 'disable' } disables (inert, aria-disabled); true brings it back", () => {
  const el = document.createElement("button");
  P.mProps(el, { can: false });
  assert.equal(el.hidden, true);
  assert.equal(el.getAttribute("data-m-can"), "hide");
  P.mProps(el, { can: { allow: false, else: "disable" } });
  assert.equal(el.hidden, false);
  assert.equal(el.inert, true);
  assert.equal(el.getAttribute("aria-disabled"), "true");
  assert.equal(el.getAttribute("data-m-can"), "disable");
  P.mProps(el, { can: true });
  assert.equal(el.hidden, false);
  assert.equal(el.inert, false);
  assert.equal(el.hasAttribute("aria-disabled"), false);
  assert.equal(el.hasAttribute("data-m-can"), false);
});

test("runtime m:tip: a hint on keyboard focus linked by aria-describedby, the text live, no wrapper element", async () => {
  await createRoot(async (dispose) => {
    const host = document.createElement("div"), btn = document.createElement("button");
    host.appendChild(btn); document.body.appendChild(host);
    // the hint is loaded on first use: have it in the module cache (on node 22 a first load can take longer than 20 ms)
    await import("../src/components/overlays/tooltip/tip.ts");
    P.mProps(btn, { tip: "Copy link" });
    await tick(20);
    assert.equal(btn.parentNode, host, "the element stays where it is");
    btn.dispatchEvent(new Event("focusin", { bubbles: true }));
    await tick();
    assert.match(btn.getAttribute("aria-describedby") ?? "", /^m-tip/);
    btn.dispatchEvent(new Event("focusout", { bubbles: true }));
    await tick();
    assert.equal(btn.hasAttribute("aria-describedby"), false);
    P.mProps(btn, { tip: "" });
    btn.dispatchEvent(new Event("focusin", { bubbles: true }));
    await tick();
    assert.equal(btn.hasAttribute("aria-describedby"), false, "an empty hint shows nothing");
    dispose(); host.remove();
  });
});

test("runtime m:reveal: hidden at once until it comes into view (once per element)", () => {
  const el = document.createElement("section");
  P.mProps(el, { reveal: true });
  assert.equal(el.style.getPropertyValue("opacity"), "0");
  el.style.removeProperty("opacity");
  P.mProps(el, { reveal: 200 });
  assert.equal(el.style.getPropertyValue("opacity"), "", "already set up once");
  const off = document.createElement("section");
  P.mProps(off, { reveal: false });
  assert.equal(off.style.getPropertyValue("opacity"), "");
});

test("sx color: a colour token's text tone (and muted); the colours left sx text", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/css/sx.css", import.meta.url), "utf8");
  const { COLOR_TOKENS } = await import("../src/theme/colors.ts");
  for (const t of [...COLOR_TOKENS, "muted"]) assert.ok(new RegExp(`\\.m-color-${t}\\{color:var\\(--m-`).test(css), t);
  assert.ok(!css.includes(".m-text-danger"), "text has no colours now");
  assert.match(c('const a = <Card sx={{ color: "danger" }} />'), /"sx": "m-color-danger"/);
});

test("sx on a component: the compiler sends it to mProps; its classes go on the root beside the root's own class", () => {
  assert.match(c('const a = <Card sx={{ p: 2, display: "flex" }} />'), /_\$m\(_\$h\(Card, \{\}\), \{"sx": "m-p-2 m-display-flex"\}\)/);
  assert.match(c('let $x = 1\nconst a = <Card sx={$x ? { p: 2 } : null} />'), /"sx": \(\) => \(/);
  const el = document.createElement("div");
  el.setAttribute("class", "m-card");
  P.mProps(el, { sx: "m-p-2 m-text-left" });
  assert.equal(el.getAttribute("class"), "m-card m-p-2 m-text-left");
  P.mProps(el, { sx: { gap: 1 } });
  assert.equal(el.getAttribute("class"), "m-card m-gap-1", "an object (by hand) resolves to classes");
  P.mProps(el, { sx: null });
  assert.equal(el.getAttribute("class"), "m-card");
});
