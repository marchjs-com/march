import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const M = { ...(await import("./model.ts")), ...(await import("./io.ts")) };
const { ThemeEditor, registerDraft, presetCopy, presetDraft } = await import("./index.ts");
const { colorThemes, setColorTheme } = await import("../../../ui/theme.ts");
const { themeCss, hadi } = await import("../../../theme/presets.ts");

test("model: presets, tokens, vars, scales", () => {
  const d = presetDraft("hadi");
  assert.equal(d.light.primary, "#F2801F");
  assert.equal(d.light.brand["brand-blue"].color, "#1D9AD6");
  // the built-in type scale comes back at ratio 1.2
  assert.deepEqual(M.typeScale(d.type).map((x) => Math.round(x.px)), [11, 12, 13, 14, 16, 20, 24, 32, 44, 60]);
  // only changed groups become tokens (plus the primary tone scale)
  assert.deepEqual(Object.keys(M.draftTokens(d)).filter((k) => !k.startsWith("primary-")), []);
  const e = { ...d, shape: { ...d.shape, border: 2, density: "compact" }, motion: { ...d.motion, base: 200 } };
  const tk = M.draftTokens(e);
  assert.equal(tk["border-w"], "2px");
  assert.equal(tk["control-h"], "1.9688rem");
  assert.equal(tk["dur"], "200ms");
  assert.match(themeCss(M.draftToTheme(e)), /--m-border-w: 2px;/);
  const v = M.draftVars(d, "dark");
  assert.equal(v["--m-bg"], "#0B1B2B");
  assert.equal(v["color-scheme"], "dark");
  assert.equal(v["--m-radius-3"], "16.8px");
  assert.equal(M.toneScale("#f2801f")[5].color, "#f2801f");
  assert.equal(M.toneScale("#f2801f").length, 10);
});

test("model: contrast audit with fixes, dark from light, from scratch", () => {
  const audit = M.contrastAudit(presetDraft("hadi").light);
  const btn = audit.find((x) => x.id === "onSolid/solid");
  assert.equal(btn.ok, false);
  assert.equal(btn.fix.key, "solid", "white cannot get whiter: the fill is darkened");
  for (const x of audit) if (x.fix) {
    const c = M.contrastAudit({ ...presetDraft("hadi").light, [x.fix.key]: x.fix.color }).find((y) => y.id === x.id);
    assert.ok(c.ok, `${x.id} passes after its fix`);
  }
  const s = M.draftFromColor("#0e7490", "HADİ Gece");
  assert.equal(s.id, "hadi-gece");
  assert.equal(s.base, null);
  assert.ok(M.contrastAudit(s.light).every((x) => x.ok), "a draft from one color passes in light");
  assert.ok(M.contrastAudit(s.dark).every((x) => x.ok), "and in its derived dark mode");
  assert.equal(M.slug("Çiçek Ağı"), "cicek-agi");
});

test("model: output and import round trips", () => {
  const d = { ...M.draftFromColor("#a3338c", "HADİ Mor"), type: { ...presetDraft("hadi").type, ratio: 1.25 } };
  assert.deepEqual(M.importTheme(M.draftJson(d)), d);
  assert.deepEqual(M.importTheme(M.draftCss(d)), d);
  assert.deepEqual(M.importTheme(M.shareUrl(d, "https://hadisosyal.com/x")), d);
  assert.deepEqual(M.decodeDraft(M.encodeDraft(d)), d);
  assert.equal(M.sharedDraft("https://hadisosyal.com/#theme=nope"), null);
  assert.match(M.draftCode(d), /export const hadiMor = defineTheme\(\{\n  id: "hadi-mor",/);
  assert.match(M.draftCode(d), /registerThemes\(\[\{ id: "hadi-mor", name: "HADİ Mor" \}\]\)/);
  // a plain theme stylesheet: colors, fonts and radius come back
  const n = M.importTheme(themeCss(hadi));
  assert.equal(n.light.primary, "#F2801F");
  assert.equal(n.dark.surface, "#0D2033");
  assert.equal(n.shape.radius, 12);
  // a defineTheme JSON
  assert.equal(M.importTheme(JSON.stringify(hadi)).light.text, "#17344F");
  assert.equal(M.importTheme("not a theme"), null);
  assert.equal(M.normalizeDraft({ light: {}, dark: {}, shape: { radius: 99 } }).shape.radius, 40, "clamped");
});

test("ThemeEditor: tokens, color edit, undo / redo, audit fix, scoped preview variables", async () => {
  const v = signal(presetCopy("hadi"));
  const el = document.createElement("div");
  document.body.appendChild(el);
  const dispose = render(() => h(ThemeEditor, { "bind:value": v, storageKey: false, warnUnsaved: false, share: false }), el);
  // the editor, its colors tab, the preview and its two parts (chart, table) are chunks of their own
  for (let i = 0; i < 100 && !(el.querySelector(".m-te-token") && el.querySelector(".m-te-cards .m-card") && el.querySelector(".m-te-table")); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(el.querySelector(".m-te-cards .m-card") && el.querySelector(".m-te-table"), "both preview parts arrive");
  assert.equal(el.querySelector(".m-te").getAttribute("aria-label"), "Theme editor");
  assert.equal(el.querySelectorAll(".m-te-base").length, 17, "sixteen presets and from scratch");
  const tokens = el.querySelectorAll(".m-te-token");
  assert.equal(tokens.length, 4 + 3 + 3 + 4 + 4 + 8);
  assert.equal(tokens[0].getAttribute("aria-pressed"), "true");
  assert.ok(el.querySelector(".m-cp"), "the selected token has a ColorPicker");
  // a tone sets the color as one undo step
  el.querySelectorAll(".m-te-tone")[7].click();
  assert.equal(v().light.primary, M.toneScale("#F2801F")[7].color);
  const iconBtn = (l) => [...el.querySelectorAll(".m-icon-btn")].find((b) => b.getAttribute("aria-label").startsWith(l));
  const undo = iconBtn("Undo");
  assert.equal(undo.disabled, false);
  undo.click();
  await Promise.resolve();
  assert.equal(v().light.primary, "#F2801F");
  iconBtn("Redo").click();
  await Promise.resolve();
  assert.equal(v().light.primary, M.toneScale("#F2801F")[7].color);
  // the audit fixes a pair
  const before = el.querySelectorAll(".m-te-check.is-bad").length;
  const fix = [...el.querySelectorAll(".m-te-check .m-btn")].find((b) => b.textContent === "Fix");
  fix.click();
  assert.ok(el.querySelectorAll(".m-te-check.is-bad").length < before);
  // the preview scope carries the draft's variables
  const scope = el.querySelector(".m-te-scope");
  assert.equal(scope.getAttribute("data-m-theme"), "my-hadi");
  assert.equal(scope.style.getPropertyValue("--m-primary").toLowerCase(), v().light.primary.toLowerCase());
  // dark mode edits the dark colors
  [...el.querySelectorAll(".m-te-colors .m-segment")].find((b) => b.textContent === "Dark").click();
  assert.equal(scope.style.getPropertyValue("color-scheme"), "dark");
  // a base preset replaces the colors
  [...el.querySelectorAll(".m-te-base")].find((b) => b.textContent.includes("Neon")).click();
  assert.equal(v().base, "neon");
  dispose();
});

test("registerDraft: the theme picker offers a runtime theme that applies itself", async () => {
  const d = M.draftFromColor("#0e7490", "HADİ Mor");
  registerDraft(d);
  assert.ok(colorThemes().some((x) => x.id === "hadi-mor" && typeof x.load === "function"));
  setColorTheme("hadi-mor");
  await Promise.resolve(); await Promise.resolve();
  const root = document.documentElement;
  assert.equal(root.getAttribute("data-m-theme"), "hadi-mor");
  assert.equal(root.style.getPropertyValue("--m-primary"), "#0e7490");
  setColorTheme("hadi");
  assert.equal(root.style.getPropertyValue("--m-primary"), "", "switching away removes its variables");
});

test("ThemeEditor: frame parts can be turned off and its texts replaced", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const opts = { storageKey: false, warnUnsaved: false, share: false };
  const dispose = render(() => [
    h("div", { class: "bare" }, h(ThemeEditor, { ...opts, class: "mine", presets: false, nameField: false, historyButtons: false, applyButton: false, previewControls: false })),
    h("div", { class: "own" }, h(ThemeEditor, { ...opts, tabs: ["colors", "type"], labels: { editor: "Look maker", tabs: { colors: "Palette" }, apply: "Try it", startFrom: "Based on", light: "Day" } })),
  ], el);
  for (let i = 0; i < 20 && !el.querySelector(".own .m-te"); i++) await new Promise((r) => setTimeout(r, 5));
  const bare = el.querySelector(".bare .m-te");
  assert.ok(bare.classList.contains("mine"));
  for (const part of [".m-te-bases", ".m-te-title", ".m-te-undo", ".m-te-redo", ".m-te-apply", ".m-te-stage-bar"]) assert.equal(bare.querySelector(part), null, part);
  assert.ok(bare.querySelector(".m-te-scope"), "the preview itself stays");
  const own = el.querySelector(".own .m-te");
  assert.equal(own.getAttribute("aria-label"), "Look maker");
  assert.deepEqual([...own.querySelector(".m-te-panel [role=tablist]").querySelectorAll("[role=tab]")].map((x) => x.textContent), ["Palette", "Typography"]);
  assert.equal(own.querySelector(".m-te-apply").textContent, "Try it");
  assert.equal(own.querySelector(".m-te-bases-label").textContent, "Based on");
  assert.ok([...own.querySelectorAll(".m-te-stage-bar .m-segment")].some((b) => b.textContent === "Day"));
  assert.ok(own.querySelector(".m-te-undo"));
  dispose();
});

test("ThemeEditor: the section tabs switch; rows are Fields; undo keys and the name field follow the history", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(ThemeEditor, { storageKey: false, warnUnsaved: false, share: false }), el);
  const wait = async (sel) => { for (let i = 0; i < 100 && !el.querySelector(sel); i++) await new Promise((r) => setTimeout(r, 10)); return el.querySelector(sel); };
  await wait(".m-te-token");
  el.querySelectorAll(".m-te-panel .m-tab")[1].click();
  const field = await wait(".m-te-field");
  assert.ok(field, "the typography tab opens");
  assert.equal(el.querySelectorAll(".m-te-panel .m-tab")[1].getAttribute("aria-selected"), "true");
  const select = field.querySelector("select");
  assert.equal(field.querySelector("label").getAttribute("for"), select.id, "a native control is named by its label");
  el.querySelectorAll(".m-te-panel .m-tab")[0].click();
  await wait(".m-te-tone");
  el.querySelectorAll(".m-te-tone")[2].click();
  const undo = el.querySelector(".m-te-undo");
  assert.equal(undo.disabled, false);
  el.querySelector(".m-te").dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(undo.disabled, true, "mod+Z undoes");
  el.querySelector(".m-te").dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(undo.disabled, false, "mod+Y redoes");
  dispose();
});

test("style: surface kind, glow, shadow kind, gradient accent, tracking, icon stroke, density become tokens and round trip", async () => {
  const P = await import("../../../theme/presets.ts");
  const css = themeCss(P.aurora);
  for (const token of ["--m-panel-bg: color-mix(", "--m-panel-filter: blur(", "--m-bg-image: radial-gradient(", "--m-primary-fill: linear-gradient(", "--m-accent-glow: ", "--m-panel-shadow: ", "--m-tracking-tight: -0.02em"]) assert.ok(css.includes(token), token);
  assert.ok(themeCss(P.noirGold).includes("--m-panel-border: var(--m-border-strong)") && themeCss(P.noirGold).includes("--m-shadow-1: none") && themeCss(P.noirGold).includes("--m-icon-stroke: 1.25"));
  assert.ok(themeCss(P.graphite).includes(`--m-space-4: ${P.spaceTokens(4, "compact")["space-4"]}`) && themeCss(P.graphite).includes("--m-control-h: "));
  assert.ok(themeCss(hadi).includes("--m-panel-bg: initial;") && !themeCss(hadi).includes("--m-panel-bg: color-mix"), "a theme without a style keeps the built-in look (and resets an outer theme's)");
  // preset → draft → theme keeps the style; density and border width live in the draft's shape
  const d = M.draftFromTheme(P.aurora);
  assert.deepEqual(d.style, { surface: "glass", glow: 0.55, shadowKind: "soft", accent: "gradient", tracking: -0.02, iconStroke: 1.75 });
  assert.deepEqual(M.draftToTheme(d).style, P.aurora.style);
  assert.equal(M.draftFromTheme(P.graphite).shape.density, "compact");
  assert.equal(M.draftToTheme(presetDraft("hadi")).style, undefined);
  // edits reach the variables of the preview; hard shadows are solid blocks in the text color
  const hard = { ...presetDraft("hadi"), style: { ...M.DEFAULT_STYLE, shadowKind: "hard", surface: "raised", glow: 1 } };
  const vars = M.draftVars(hard, "light");
  assert.equal(vars["--m-shadow-1"], `2px 2px 0 ${hard.light.text}`);
  assert.match(vars["--m-panel-shadow"], /^var\(--m-shadow-2\), 0 0 0 1px color-mix\(/);
  assert.equal(vars["--m-panel-border"], "transparent");
  // a draft saved before the style existed, and wrong values, get the built-in style
  const old = JSON.parse(JSON.stringify(presetDraft("night"))); delete old.style;
  assert.deepEqual(M.normalizeDraft(old).style, M.DEFAULT_STYLE);
  assert.equal(M.normalizeDraft({ ...old, style: { surface: "wood", glow: 9, accent: "gradient" } }).style.glow, 1);
  assert.deepEqual(M.importTheme(M.draftJson(d)).style, d.style);
});

test("ThemeEditor: the Style tab edits the surface, the glow and the icon stroke", async () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const v = signal(null);
  const dispose = render(() => h(ThemeEditor, { "bind:value": v, base: "hadi", storageKey: false, share: false, warnUnsaved: false, tabs: ["style"], preview: false }), el);
  const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  await wait(200);
  const glass = [...el.querySelectorAll("[role=radio]")].find((b) => b.textContent.trim() === "Glass");
  assert.ok(glass, "the surface choice is there");
  glass.click();
  await wait();
  assert.equal(v().style.surface, "glass");
  const gradient = [...el.querySelectorAll("[role=radio]")].find((b) => b.textContent.trim() === "Gradient");
  gradient.click();
  await wait();
  assert.equal(v().style.accent, "gradient");
  assert.equal(el.querySelectorAll("input[type=range]").length, 3, "glow, heading letter spacing, icon stroke");
  dispose();
});
