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
  assert.match(themeCss(M.draftToTheme(e)), /--hm-border-w: 2px;/);
  const v = M.draftVars(d, "dark");
  assert.equal(v["--hm-bg"], "#0B1B2B");
  assert.equal(v["color-scheme"], "dark");
  assert.equal(v["--hm-radius-3"], "16.8px");
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
  const s = M.draftFromColor("#0e7490", "Acme Gece");
  assert.equal(s.id, "acme-gece");
  assert.equal(s.base, null);
  assert.ok(M.contrastAudit(s.light).every((x) => x.ok), "a draft from one color passes in light");
  assert.ok(M.contrastAudit(s.dark).every((x) => x.ok), "and in its derived dark mode");
  assert.equal(M.slug("Çiçek Ağı"), "cicek-agi");
});

test("model: output and import round trips", () => {
  const d = { ...M.draftFromColor("#a3338c", "Acme"), type: { ...presetDraft("hadi").type, ratio: 1.25 } };
  assert.deepEqual(M.importTheme(M.draftJson(d)), d);
  assert.deepEqual(M.importTheme(M.draftCss(d)), d);
  assert.deepEqual(M.importTheme(M.shareUrl(d, "https://acme.test/x")), d);
  assert.deepEqual(M.decodeDraft(M.encodeDraft(d)), d);
  assert.equal(M.sharedDraft("https://acme.test/#theme=nope"), null);
  assert.match(M.draftCode(d), /export const acme = defineTheme\(\{\n  id: "acme",/);
  assert.match(M.draftCode(d), /registerThemes\(\[\{ id: "acme", name: "Acme" \}\]\)/);
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
  // the editor, its colors tab and the preview are chunks of their own
  for (let i = 0; i < 100 && !(el.querySelector(".hm-te-token") && el.querySelector(".hm-te-screen")); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(el.querySelector(".hm-te").getAttribute("aria-label"), "Theme editor");
  assert.equal(el.querySelectorAll(".hm-te-base").length, 8, "seven presets and from scratch");
  const tokens = el.querySelectorAll(".hm-te-token");
  assert.equal(tokens.length, 4 + 3 + 3 + 4 + 4 + 8);
  assert.equal(tokens[0].getAttribute("aria-pressed"), "true");
  assert.ok(el.querySelector(".hm-cp"), "the selected token has a ColorPicker");
  // a tone sets the color as one undo step
  el.querySelectorAll(".hm-te-tone")[7].click();
  assert.equal(v().light.primary, M.toneScale("#F2801F")[7].color);
  const iconBtn = (l) => [...el.querySelectorAll(".hm-icon-btn")].find((b) => b.getAttribute("aria-label").startsWith(l));
  const undo = iconBtn("Undo");
  assert.equal(undo.disabled, false);
  undo.click();
  await Promise.resolve();
  assert.equal(v().light.primary, "#F2801F");
  iconBtn("Redo").click();
  await Promise.resolve();
  assert.equal(v().light.primary, M.toneScale("#F2801F")[7].color);
  // the audit fixes a pair
  const before = el.querySelectorAll(".hm-te-check.is-bad").length;
  const fix = [...el.querySelectorAll(".hm-te-check .hm-btn")].find((b) => b.textContent === "Fix");
  fix.click();
  assert.ok(el.querySelectorAll(".hm-te-check.is-bad").length < before);
  // the preview scope carries the draft's variables
  const scope = el.querySelector(".hm-te-scope");
  assert.equal(scope.getAttribute("data-hm-theme"), "my-hadi");
  assert.equal(scope.style.getPropertyValue("--hm-primary").toLowerCase(), v().light.primary.toLowerCase());
  // dark mode edits the dark colors
  [...el.querySelectorAll(".hm-te-colors .hm-segment")].find((b) => b.textContent === "Dark").click();
  assert.equal(scope.style.getPropertyValue("color-scheme"), "dark");
  // a base preset replaces the colors
  [...el.querySelectorAll(".hm-te-base")].find((b) => b.textContent.includes("Neon")).click();
  assert.equal(v().base, "neon");
  dispose();
});

test("registerDraft: the theme picker offers a runtime theme that applies itself", async () => {
  const d = M.draftFromColor("#0e7490", "Acme");
  registerDraft(d);
  assert.ok(colorThemes().some((x) => x.id === "acme" && typeof x.load === "function"));
  setColorTheme("acme");
  await Promise.resolve(); await Promise.resolve();
  const root = document.documentElement;
  assert.equal(root.getAttribute("data-hm-theme"), "acme");
  assert.equal(root.style.getPropertyValue("--hm-primary"), "#0e7490");
  setColorTheme("hadi");
  assert.equal(root.style.getPropertyValue("--hm-primary"), "", "switching away removes its variables");
});
