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
  for (let i = 0; i < 100 && !(el.querySelector(".hm-te-token") && el.querySelector(".hm-te-cards .hm-card") && el.querySelector(".hm-te-table")); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(el.querySelector(".hm-te-cards .hm-card") && el.querySelector(".hm-te-table"), "both preview parts arrive");
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
  const d = M.draftFromColor("#0e7490", "HADİ Mor");
  registerDraft(d);
  assert.ok(colorThemes().some((x) => x.id === "hadi-mor" && typeof x.load === "function"));
  setColorTheme("hadi-mor");
  await Promise.resolve(); await Promise.resolve();
  const root = document.documentElement;
  assert.equal(root.getAttribute("data-hm-theme"), "hadi-mor");
  assert.equal(root.style.getPropertyValue("--hm-primary"), "#0e7490");
  setColorTheme("hadi");
  assert.equal(root.style.getPropertyValue("--hm-primary"), "", "switching away removes its variables");
});

test("ThemeEditor: frame parts can be turned off and its texts replaced", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const opts = { storageKey: false, warnUnsaved: false, share: false };
  const dispose = render(() => [
    h("div", { class: "bare" }, h(ThemeEditor, { ...opts, class: "mine", presets: false, nameField: false, historyButtons: false, applyButton: false, previewControls: false })),
    h("div", { class: "own" }, h(ThemeEditor, { ...opts, tabs: ["colors", "type"], labels: { editor: "Look maker", tabs: { colors: "Palette" }, apply: "Try it", startFrom: "Based on", light: "Day" } })),
  ], el);
  for (let i = 0; i < 20 && !el.querySelector(".own .hm-te"); i++) await new Promise((r) => setTimeout(r, 5));
  const bare = el.querySelector(".bare .hm-te");
  assert.ok(bare.classList.contains("mine"));
  for (const part of [".hm-te-bases", ".hm-te-title", ".hm-te-undo", ".hm-te-redo", ".hm-te-apply", ".hm-te-stage-bar"]) assert.equal(bare.querySelector(part), null, part);
  assert.ok(bare.querySelector(".hm-te-scope"), "the preview itself stays");
  const own = el.querySelector(".own .hm-te");
  assert.equal(own.getAttribute("aria-label"), "Look maker");
  assert.deepEqual([...own.querySelector(".hm-te-panel [role=tablist]").querySelectorAll("[role=tab]")].map((x) => x.textContent), ["Palette", "Typography"]);
  assert.equal(own.querySelector(".hm-te-apply").textContent, "Try it");
  assert.equal(own.querySelector(".hm-te-bases-label").textContent, "Based on");
  assert.ok([...own.querySelectorAll(".hm-te-stage-bar .hm-segment")].some((b) => b.textContent === "Day"));
  assert.ok(own.querySelector(".hm-te-undo"));
  dispose();
});

test("ThemeEditor: the section tabs switch; rows are Fields; undo keys and the name field follow the history", async () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(ThemeEditor, { storageKey: false, warnUnsaved: false, share: false }), el);
  const wait = async (sel) => { for (let i = 0; i < 100 && !el.querySelector(sel); i++) await new Promise((r) => setTimeout(r, 10)); return el.querySelector(sel); };
  await wait(".hm-te-token");
  el.querySelectorAll(".hm-te-panel .hm-tab")[1].click();
  const field = await wait(".hm-te-field");
  assert.ok(field, "the typography tab opens");
  assert.equal(el.querySelectorAll(".hm-te-panel .hm-tab")[1].getAttribute("aria-selected"), "true");
  const select = field.querySelector("select");
  assert.equal(field.querySelector("label").getAttribute("for"), select.id, "a native control is named by its label");
  el.querySelectorAll(".hm-te-panel .hm-tab")[0].click();
  await wait(".hm-te-tone");
  el.querySelectorAll(".hm-te-tone")[2].click();
  const undo = el.querySelector(".hm-te-undo");
  assert.equal(undo.disabled, false);
  el.querySelector(".hm-te").dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(undo.disabled, true, "mod+Z undoes");
  el.querySelector(".hm-te").dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(undo.disabled, false, "mod+Y redoes");
  dispose();
});
