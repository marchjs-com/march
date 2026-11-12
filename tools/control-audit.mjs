#!/usr/bin/env node
// Control audit of the showcase in a headless Chromium browser: every visible option control — a switch, checkbox,
// choice (radio / segmented / chip / pressed button) or slider in a Playground panel (.sc-play-panel: Playground,
// PlayStage / ComponentDemo, LitePlayground, MotionDemo), an options row (.sc-options) or a card titled "Seçenekler" —
// must change something that can be seen when it is used: the text, or the computed style of an element outside the
// control itself. One that changes nothing is reported as `dead-control`.
// (Controls that are the demo's subject, such as a day picker in a form demo, are not options and are not checked.)
//
// Every page is covered: the top-level pages and the ones under a wildcard route (/motion/svg…). Cards that load
// lazily (component folders drawn by ComponentDemo, `lazy()` stages) are waited for, the page is scrolled through so
// cards that load when visible come in too, and controls that appear later (an option shown only while it has an
// effect) are picked up as they appear. Every choice of a group is tried, not only one.
//
//   node tools/control-audit.mjs                     serves examples/showcase/dist itself (build it first)
//   node tools/control-audit.mjs --routes /language,/managers --width 1024 --verbose
// A control can opt out with data-audit-skip (on it or an ancestor), e.g. one whose effect is outside the page.
// Exit code 1 when anything is found. CI runs it after building the showcase (.github/workflows/ci.yml).
import { openHeadless, allShowcaseRoutes, flag as argFlag, sleep } from "./lib/headless.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => argFlag(argv, k, d);
const ROUTES = flag("--routes", null)?.split(",") ?? allShowcaseRoutes();
const WIDTH = Number(flag("--width", "1440"));
const VERBOSE = argv.includes("--verbose");
/** Upper bound of controls tried on one page (a page that keeps adding controls must not run forever). */
const MAX_PER_PAGE = 400;

// in the page: helpers kept on window.__ca so each step is one short evaluate
const SETUP = `(() => {
  const PROPS = ["display", "visibility", "opacity", "transform", "color", "background-color", "background-image", "border-top-color",
    "border-top-width", "box-shadow", "outline-style", "filter", "width", "height", "padding-top", "padding-left", "gap", "font-size",
    "font-weight", "grid-template-columns", "flex-direction", "justify-content", "align-items", "border-top-left-radius", "translate", "scale",
    "animation-name", "text-decoration-line", "cursor", "font-family", "letter-spacing", "line-height", "object-fit", "object-position",
    "mix-blend-mode", "background-size", "background-position", "background-blend-mode", "border-top-style", "text-align", "inset", "z-index",
    "fill", "stroke"];
  const SEL = '[role=switch], input[type=checkbox], input[type=radio], input[type=range], [role=radio], [role=tab], [role=option], .hm-chip[aria-pressed], button[aria-pressed]';
  const skip = (el) => !!el.closest("[data-audit-skip], .hm-layer, .hm-shell-nav, .hm-app-nav, header.hm-topbar, .sc-code, pre");
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden], [inert]"); };
  const root = () => document.querySelector("main") ?? document.body;
  const optionRoots = () => [...root().querySelectorAll(".sc-play-panel, .sc-options"),
    ...[...root().querySelectorAll(".hm-card")].filter((c) => c.querySelector(".hm-card-title")?.textContent.trim() === "Seçenekler")];
  // the control's own box (its label, the segmented group) is left out: it always changes when used
  const own = (c) => c.closest("label, .hm-toggle, .hm-switch, .hm-segmented, [role=radiogroup], [role=tablist], [role=listbox], .hm-choice, .hm-chip") ?? c;
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
  const picked = (x) => x.getAttribute("aria-checked") === "true" || x.getAttribute("aria-selected") === "true" || x.checked === true;
  const choice = (c) => c.matches("[role=radio], [role=tab], [role=option], input[type=radio]");
  const name = (c) => (c.getAttribute("aria-label") || (c.closest(".sc-play-opt, .hm-field") ?? own(c)).textContent || c.tagName).trim().replace(/\\s+/g, " ").slice(0, 60) + (choice(c) ? " → " + (c.textContent.trim() || c.value || "").slice(0, 20) : "");
  const where = (c) => (c.closest(".sc-demo")?.querySelector(".sc-demo-title")?.textContent ?? c.closest(".hm-card")?.querySelector(".hm-card-title")?.textContent ?? "").trim();
  // use: flip a switch / checkbox, pick another option of a group, move a slider; returns an undo
  const fire = (c) => { c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true })); };
  const use = (c) => {
    if (c.matches("input[type=range]")) {
      const old = c.value, min = Number(c.min || 0), max = Number(c.max || 100);
      c.value = String(Number(old) === max ? min : max); fire(c);
      return () => { c.value = old; fire(c); };
    }
    if (choice(c)) {
      const group = c.closest("[role=radiogroup], [role=tablist], [role=listbox]") ?? c.form ?? c.parentElement;
      const sel = c.matches("input[type=radio]") ? 'input[type=radio][name="' + c.name + '"]' : c.matches("[role=tab]") ? "[role=tab]" : c.matches("[role=option]") ? "[role=option]" : "[role=radio]";
      const was = [...group.querySelectorAll(sel)].find(picked);
      c.click();
      return () => was?.click();
    }
    c.click();
    return () => c.click();
  };
  const key = (c) => where(c) + " § " + name(c);
  // every visible, enabled option control not tried yet (a choice that is already selected changes nothing by design)
  const pending = () => [...new Set(optionRoots().flatMap((o) => [...o.querySelectorAll(SEL)]))].filter((c) => !skip(c) && shown(c) && !c.disabled
    && c.getAttribute("aria-disabled") !== "true" && !(choice(c) && picked(c)) && !c.hasAttribute("data-ca-done") && !window.__ca.tried.has(key(c)));
  // cards that load lazily: scroll the page through (cards that load when visible) and wait until no slot is waiting
  const settle = async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const busy = () => root().querySelector(".hm-lazy-slot.is-wait");
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(400, innerHeight * 0.8)) { scrollTo(0, y); await wait(80); }
    for (let i = 0; i < 60 && busy(); i++) await wait(100);
    scrollTo(0, 0); await wait(100);
    return !busy();
  };
  window.__ca = { pending, snap, use, name, where, key, settle, tried: new Set() };
  return true;
})()`;

const { ev, errs, load, close } = await openHeadless({ base: flag("--base", null) });
const findings = [];
let total = 0;
for (const route of ROUTES) {
  await load(route, WIDTH);
  await ev(SETUP);
  if (!(await ev("__ca.settle()"))) findings.push({ route, kind: "lazy", at: "", detail: "a lazy card was still loading after 6 s" });
  let n = 0;
  for (; n < MAX_PER_PAGE; n++) {
    // the next control not tried yet: picked again each time, so controls that appear later are found too
    const info = await ev(`(() => { const c = __ca.pending()[0]; if (!c) return null; c.setAttribute("data-ca-done", ""); __ca.tried.add(__ca.key(c));
      c.scrollIntoView({ block: "center" }); return { name: __ca.name(c), where: __ca.where(c), key: __ca.key(c) }; })()`);
    if (!info) break;
    await sleep(150);
    const changed = await ev(`(async () => { const c = [...document.querySelectorAll("[data-ca-done]")].find((x) => __ca.key(x) === ${JSON.stringify(info.key)}); if (!c) return true;
      const before = __ca.snap(c); const undo = __ca.use(c); await new Promise((r) => setTimeout(r, 450)); const after = __ca.snap(c);
      undo(); await new Promise((r) => setTimeout(r, 250)); return before !== after; })()`);
    if (VERBOSE) console.log(`  ${changed === false ? "✖" : "✓"} ${route} [${info.where}] ${info.name}`);
    if (changed === false) findings.push({ route, kind: "dead-control", at: info.where, detail: info.name });
  }
  total += n;
  if (n >= MAX_PER_PAGE) findings.push({ route, kind: "limit", at: "", detail: `more than ${MAX_PER_PAGE} controls: the page keeps adding them` });
  for (const e of new Set(errs)) findings.push({ route, kind: "console", at: "", detail: e });
  errs.length = 0;
  process.stdout.write(findings.some((f) => f.route === route) ? "✖" : "·");
}
await close();
console.log("");
for (const f of findings) console.log(`✖ ${f.route}  ${f.kind}  ${f.at ? `[${f.at}] ` : ""}${f.detail}`);
console.log(findings.length ? `${findings.length} problems (${total} controls on ${ROUTES.length} pages)` : `✔ ${ROUTES.length} pages, ${total} controls: every control changes something`);
process.exit(findings.length ? 1 : 0);
