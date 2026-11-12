#!/usr/bin/env node
// Control audit of the showcase in a headless Chromium browser: every visible option control — a switch, checkbox,
// choice (radio / segmented / chip) or slider in a Playground panel (.sc-play-panel), an options row (.sc-options) or a
// card titled "Seçenekler" — must change something that can be seen when it is used: the text, or the computed style
// of an element outside the control itself. One that changes nothing is reported as `dead-control`.
// (Controls that are the demo's subject, such as a day picker in a form demo, are not options and are not checked.)
//
//   node tools/control-audit.mjs                     serves examples/showcase/dist itself (build it first)
//   node tools/control-audit.mjs --routes /language,/managers --width 1024
// A control can opt out with data-audit-skip (on it or an ancestor), e.g. one whose effect is outside the page.
// Exit code 1 when anything is found.
import { openHeadless, showcaseRoutes, flag as argFlag, sleep } from "./lib/headless.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => argFlag(argv, k, d);
const ROUTES = flag("--routes", null)?.split(",") ?? showcaseRoutes();
const WIDTH = Number(flag("--width", "1440"));

// in the page: helpers kept on window.__ca so each step is one short evaluate
const SETUP = `(() => {
  const PROPS = ["display", "visibility", "opacity", "transform", "color", "background-color", "background-image", "border-top-color",
    "border-top-width", "box-shadow", "outline-style", "filter", "width", "height", "padding-top", "padding-left", "gap", "font-size",
    "font-weight", "grid-template-columns", "flex-direction", "justify-content", "align-items", "border-top-left-radius", "translate", "scale",
    "animation-name", "text-decoration-line", "cursor", "font-family", "letter-spacing", "line-height", "object-fit", "object-position",
    "mix-blend-mode", "background-size", "background-position", "background-blend-mode", "border-top-style", "text-align", "inset", "z-index"];
  const SEL = '[role=switch], input[type=checkbox], input[type=range], [role=radio], [role=tab], .hm-chip[aria-pressed]';
  const skip = (el) => !!el.closest("[data-audit-skip], .hm-layer, .hm-shell-nav, .hm-app-nav, header.hm-topbar, .sc-code, pre");
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden], [inert]"); };
  const root = () => document.querySelector("main") ?? document.body;
  const optionRoots = () => [...root().querySelectorAll(".sc-play-panel, .sc-options"),
    ...[...root().querySelectorAll(".hm-card")].filter((c) => c.querySelector(".hm-card-title")?.textContent.trim() === "Seçenekler")];
  // the control's own box (its label, the segmented group) is left out: it always changes when used
  const own = (c) => c.closest("label, .hm-toggle, .hm-switch, .hm-segmented, [role=radiogroup], [role=tablist], .hm-choice, .hm-chip") ?? c;
  const snap = (c) => {
    const box = own(c); const parts = [];
    const walk = (el) => {
      if (el === box || el.nodeType !== 1 || el.matches(".hm-spinner, [data-audit-volatile]")) return;
      // only what can be seen counts: a class or aria attribute that changes no style is not an effect
      if (el.namespaceURI === "http://www.w3.org/2000/svg") { parts.push(el.outerHTML); return; }
      const cs = getComputedStyle(el);
      parts.push(el.tagName + "|" + (el.value ?? "") + "|" + PROPS.map((p) => cs.getPropertyValue(p)).join(";"));
      for (const n of el.childNodes) if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) parts.push("#" + t); } else walk(n);
    };
    walk(root());
    return parts.join("\\n");
  };
  const name = (c) => (c.getAttribute("aria-label") || (c.closest(".sc-play-opt, .hm-field") ?? own(c)).textContent || c.tagName).trim().replace(/\\s+/g, " ").slice(0, 60) + (c.matches("[role=radio], [role=tab]") ? " → " + c.textContent.trim().slice(0, 20) : "");
  const where = (c) => (c.closest(".sc-demo")?.querySelector(".sc-demo-title")?.textContent ?? c.closest(".hm-card")?.querySelector(".hm-card-title")?.textContent ?? "").trim();
  // use: flip a switch / checkbox, pick another option of a group, move a slider; returns an undo
  const use = (c) => {
    if (c.matches("input[type=range]")) {
      const old = c.value, min = Number(c.min || 0), max = Number(c.max || 100);
      c.value = String(Number(old) === max ? min : max); c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true }));
      return () => { c.value = old; c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true })); };
    }
    if (c.matches("[role=radio], [role=tab]")) {
      const group = c.closest("[role=radiogroup], [role=tablist]") ?? c.parentElement;
      const was = [...group.querySelectorAll(c.matches("[role=tab]") ? "[role=tab]" : "[role=radio]")].find((x) => x.getAttribute("aria-checked") === "true" || x.getAttribute("aria-selected") === "true" || x.checked);
      c.click();
      return () => was?.click();
    }
    c.click();
    return () => c.click();
  };
  const list = () => [...new Set(optionRoots().flatMap((o) => [...o.querySelectorAll(SEL)]))].filter((c) => !skip(c) && shown(c) && !c.disabled && c.getAttribute("aria-disabled") !== "true"
    // a choice that is already selected changes nothing by design: try the others
    && !(c.matches("[role=radio], [role=tab]") && (c.getAttribute("aria-checked") === "true" || c.getAttribute("aria-selected") === "true" || c.checked)));
  window.__ca = { list, snap, use, name, where };
  return list().length;
})()`;

const { ev, errs, load, close } = await openHeadless({ base: flag("--base", null) });
const findings = [];
for (const route of ROUTES) {
  await load(route, WIDTH);
  const n = (await ev(SETUP)) ?? 0;
  // radios of one group: one representative is enough (any other option must change something)
  const seenGroups = new Set();
  for (let i = 0; i < n; i++) {
    const info = await ev(`(() => { const c = __ca.list()[${i}]; if (!c) return null; c.scrollIntoView({ block: "center" });
      const g = c.closest("[role=radiogroup], [role=tablist]"); if (g && !g.dataset.caId) g.dataset.caId = String(Math.random());
      return { name: __ca.name(c), where: __ca.where(c), group: g?.dataset.caId ?? null }; })()`);
    if (!info) break;
    if (info.group) { if (seenGroups.has(info.group)) continue; seenGroups.add(info.group); }
    await sleep(150);
    const changed = await ev(`(async () => { const c = __ca.list()[${i}]; if (!c) return true; const before = __ca.snap(c);
      const undo = __ca.use(c); await new Promise((r) => setTimeout(r, 450)); const after = __ca.snap(c);
      undo(); await new Promise((r) => setTimeout(r, 250)); return before !== after; })()`);
    if (changed === false) findings.push({ route, kind: "dead-control", at: info.where, detail: info.name });
  }
  for (const e of new Set(errs)) findings.push({ route, kind: "console", at: "", detail: e });
  errs.length = 0;
  process.stdout.write(findings.some((f) => f.route === route) ? "✖" : "·");
}
await close();
console.log("");
for (const f of findings) console.log(`✖ ${f.route}  ${f.kind}  ${f.at ? `[${f.at}] ` : ""}${f.detail}`);
console.log(findings.length ? `${findings.length} problems` : `✔ ${ROUTES.length} pages: every control changes something`);
process.exit(findings.length ? 1 : 0);
