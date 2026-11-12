import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, h, render } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const T = await import("../src/theme/index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test("themes.css is generated from the presets (node tools/gen-themes.js)", () => {
  execFileSync(process.execPath, ["tools/gen-themes.js", "--check"], { cwd: new URL("..", import.meta.url) });
});

test("defineTheme validates; themeCss scopes light, dark and the default", () => {
  assert.throws(() => T.defineTheme({ ...T.hadi, id: "Bad Id" }), /kebab-case/);
  const css = T.themeCss(T.hadi, true);
  assert.match(css, /\[data-hm-theme="hadi"\]/);
  assert.match(css, /:root:not\(\[data-hm-theme\]\)/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.equal(T.THEMES[0].id, T.DEFAULT_THEME);
});

test("setColorTheme loads the theme's stylesheet on demand, then sets data-hm-theme (the default removes it)", async () => {
  U.setColorTheme("neon");
  const link = document.head.querySelector('link[data-hm-theme-css="neon"]');
  assert.ok(link, "a <link rel=stylesheet> for the theme");
  assert.match(link.getAttribute("href") ?? link.href, /themes\/neon\.css$/);
  assert.equal(document.documentElement.getAttribute("data-hm-theme"), null, "not applied before the CSS is in");
  link.onload(); await tick();
  assert.equal(document.documentElement.getAttribute("data-hm-theme"), "neon");
  U.setColorTheme("neon");
  assert.equal(document.head.querySelectorAll('link[data-hm-theme-css="neon"]').length, 1, "loaded once");
  assert.equal(U.colorTheme(), "neon");
  U.setColorTheme("hadi");
  assert.equal(document.documentElement.getAttribute("data-hm-theme"), null);
  assert.ok(U.colorThemes().length >= 7);
});

test("Pagination: ellipses, current page, prev/next", async () => {
  const page = signal(5);
  const m = mount(() => h(U.Pagination, { page, pages: 20, onPage: (p) => page.set(p) }));
  const labels = () => [...m.el.querySelectorAll(".hm-page-btn")].filter((b) => !b.classList.contains("hm-page-nav")).map((b) => b.textContent);
  assert.deepEqual(labels(), ["1", "4", "5", "6", "20"]);
  assert.equal(m.el.querySelector('[aria-current="page"]').textContent, "5");
  m.el.querySelectorAll(".hm-page-nav")[1].click();
  await tick();
  assert.equal(page(), 6);
  m.dispose();
});

test("Rating: radio group, click and arrow keys", async () => {
  const v = signal(2);
  const m = mount(() => h(U.Rating, { value: v, setValue: (x) => v.set(x) }));
  const stars = m.el.querySelectorAll('[role="radio"]');
  assert.equal(stars.length, 5);
  stars[3].click();
  assert.equal(v(), 4);
  const key = (el, k) => { el.focus(); const e = new Event("keydown", { bubbles: true, cancelable: true }); e.key = k; el.dispatchEvent(e); };
  key(stars[3], "ArrowRight"); assert.equal(v(), 5, "the value follows focus");
  key(stars[4], "ArrowRight"); assert.equal(v(), 5, "no wrap");
  key(stars[4], "Home"); assert.equal(v(), 1);
  m.el.setAttribute("dir", "rtl");
  key(stars[0], "ArrowLeft"); assert.equal(v(), 2, "RTL: left is next");
  m.dispose();
});

test("HADİ theme: the four official colors as tokens, legible semantic mapping, chart and ribbon order", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/css/themes/hadi.css", import.meta.url), "utf8");
  for (const [name, hex, soft] of [["brand-orange", "#F2801F", "#FEF0E3"], ["brand-blue", "#1D9AD6", "#E5F4FB"], ["brand-green", "#78BE3A", "#EEF7E5"], ["brand-purple", "#A3338C", "#F6E8F3"]]) {
    assert.match(css, new RegExp(`--hm-${name}: ${hex};`));
    assert.match(css, new RegExp(`--hm-${name}-soft: ${soft};`));
    assert.match(css, new RegExp(`--hm-on-${name}: #`));
  }
  assert.match(css, /--hm-cat-1: #F2801F; --hm-cat-2: #1D9AD6; --hm-cat-3: #78BE3A; --hm-cat-4: #A3338C;/);
  assert.match(css, /--hm-mark: linear-gradient\(135deg, #F2801F 0%, #1D9AD6 36%, #78BE3A 66%, #A3338C 100%\)/);
  const L = T.hadi.light, D = T.hadi.dark;
  // fills, lines and icons use the pure brand colors; only text uses the --hm-X-text shade (AA on the surface)
  assert.equal(L.primary, "#F2801F"); assert.equal(D.primary, "#F2801F");
  assert.equal(L.info, "#1D9AD6"); assert.equal(L.success, "#78BE3A"); assert.equal(L.special, "#A3338C");
  assert.match(css, /--hm-primary: #F2801F;/);
  assert.ok(T.contrast(L.muted, L.surface) >= 4.5, "muted text reads");
  for (const [scheme, block] of [["light", css.split("@media")[0]], ["dark", css.split("@media")[1]]]) {
    const surface = block.match(/--hm-surface: (#[0-9A-F]{6});/i)[1];
    for (const k of ["primary", "info", "success", "danger", "warn", "special"]) {
      const text = block.match(new RegExp(`--hm-${k}-text: (#[0-9A-F]{6});`, "i"))[1];
      assert.ok(T.contrast(text, surface) >= 4.5, `${scheme} --hm-${k}-text ${text} reads on ${surface}`);
    }
  }
  assert.equal(T.onBrandFill("#78BE3A"), "#14181F", "white on the brand green is under 2.6:1, so dark text");
  assert.equal(T.onBrandFill("#1D9AD6"), "#FFFFFF");
});

test("restyleInstantly: a theme, mode or accent change lands with transitions off for one style pass", async () => {
  const TH = await import("../src/ui/theme.ts");
  const root = document.documentElement;
  let seen = null;
  TH.restyleInstantly(() => { seen = root.hasAttribute("data-hm-restyling"); root.setAttribute("data-theme", "dark"); });
  assert.equal(seen, true, "the change runs while transitions are off");
  assert.equal(root.getAttribute("data-theme"), "dark");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(root.hasAttribute("data-hm-restyling"), false, "and they come back right after");
  const css = (await import("node:fs")).readFileSync(new URL("../src/ui/theme.css", import.meta.url), "utf8");
  assert.match(css, /\[data-hm-restyling\][^{]*\{\s*transition:\s*none !important/);
  root.removeAttribute("data-theme");
});
