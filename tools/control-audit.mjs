#!/usr/bin/env node
// Control audit of the showcase in a headless Chromium browser: every visible option control — a switch, checkbox,
// choice (radio / segmented / chip / pressed button) or slider in a Playground panel (.sc-play-panel: Playground,
// PlayStage / ComponentDemo, LitePlayground, MotionDemo), an options row (.sc-options) or a card titled "Seçenekler" —
// must change something that can be seen when it is used: the text, or the computed style of an element outside the
// control itself. One that changes nothing is reported as `dead-control`. The control is focused and used (a slider is
// moved in several steps, as a drag does): it must stay the same DOM node and keep the focus, else `rebuilt-control`
// (a control rebuilt on every change breaks a drag: pointer and focus stay with the old node). Layout counts by the boxes
// (getBoundingClientRect), not by style: a class change that moves nothing is no effect. An element whose aria-orientation
// does not match how its items are laid out is reported as `orientation`.
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
const STREAM = argv.includes("--stream");
/** Upper bound of controls tried on one page (a page that keeps adding controls must not run forever). */
const MAX_PER_PAGE = 400;

// in the page: helpers kept on window.__ca so each step is one short evaluate
const SETUP = `(() => {
  // paint: a change in one of these is seen as it is
  const PROPS = ["visibility", "opacity", "transform", "color", "background-color", "background-image", "border-top-color",
    "box-shadow", "outline-style", "filter", "font-size", "font-weight", "border-top-left-radius", "translate", "scale",
    "animation-name", "text-decoration-line", "cursor", "font-family", "letter-spacing", "object-fit", "object-position",
    "mix-blend-mode", "background-size", "background-position", "background-blend-mode", "border-top-style", "text-align", "z-index",
    "fill", "stroke", "accent-color"];
  const PSEUDO = ["visibility", "opacity", "transform", "color", "background-color", "background-image", "border-top-color", "border-top-style",
    "border-top-width", "width", "height", "box-shadow", "rotate", "scale", "translate", "inset-inline-start", "inset-block-start"];
  // layout (display, width, flex-direction, grid-template…) is not compared as style: it counts only when a box really
  // moves or resizes (getBoundingClientRect). A class that says "horizontal" while the bar stays vertical is no effect.
  const SEL = '[role=switch], input[type=checkbox], input[type=radio], input[type=range], [role=radio], [role=tab], [role=option], .hm-chip[aria-pressed], button[aria-pressed]';
  const skip = (el) => !!el.closest("[data-audit-skip], .hm-layer, .hm-shell-nav, .hm-app-nav, header.hm-topbar, .sc-code, pre");
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden], [inert]"); };
  const root = () => document.querySelector("main") ?? document.body;
  const optionRoots = () => [...root().querySelectorAll(".sc-play-panel, .sc-options"),
    ...[...root().querySelectorAll(".hm-card")].filter((c) => c.querySelector(".hm-card-title")?.textContent.trim() === "Seçenekler")];
  // the control's own box (its label, the segmented group) is left out: it always changes when used
  const own = (c) => c.closest("label, .hm-toggle, .hm-switch, .hm-segmented, [role=radiogroup], [role=tablist], [role=listbox], .hm-choice, .hm-chip") ?? c;
  const snap = (c) => {
    // the whole options panel is left out (a label that shows the value, "Son kullanılanlar: 33", is not an effect);
    // in an options row or a "Seçenekler" card, the control's own box
    const box = c.closest(".sc-play-panel") ?? own(c); const parts = [];
    const walk = (el) => {
      if (el === box || el.nodeType !== 1 || el.matches(".hm-spinner, [data-audit-volatile]")) return;
      // only what can be seen counts: a class or aria attribute that changes no style is not an effect
      if (el.namespaceURI === "http://www.w3.org/2000/svg") { parts.push(el.outerHTML); return; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect(), o = root().getBoundingClientRect(), q = (n) => Math.round(n);
      parts.push(el.tagName + "|" + (el.value ?? "") + "|" + PROPS.map((p) => cs.getPropertyValue(p)).join(";") + "|" + [q(r.left - o.left), q(r.top - o.top), q(r.width), q(r.height)].join(",")
        // a running animation (every animation goes through the motion engine: WAAPI) counts by its timing — speed, easing,
        // repeat — not by the frame it happens to be on
        + "|" + (el.getAnimations?.() ?? []).map((x) => { const t = x.effect?.getTiming?.() ?? {}; return [t.duration, t.iterations, t.direction, t.easing, t.delay, x.playbackRate].join("/"); }).join(";")
        // parts drawn by ::before / ::after (a line, an arrow, a dot, a mark) are seen too: what they paint and their size
        + "|" + ["::before", "::after"].map((ps) => { const p = getComputedStyle(el, ps); return p.content === "none" || p.display === "none" ? "" : [p.content, ...PSEUDO.map((k) => p.getPropertyValue(k))].join(";"); }).join("~")
        // a placeholder is text the user reads; a range input paints its thumb and track from the accent
        + "|" + (el.placeholder ?? "") + "|" + (el.matches("input[type=range], progress, meter") ? cs.getPropertyValue("accent-color") + cs.getPropertyValue("--hm-accent") : ""));
      for (const n of el.childNodes) if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) parts.push("#" + t); } else walk(n);
    };
    walk(root());
    // open layers (menus, popovers, drawers, dialogs) are drawn outside the page body
    for (const l of document.querySelectorAll(".hm-layer")) if (!root().contains(l)) walk(l);
    return parts.join("\\n");
  };
  const picked = (x) => x.getAttribute("aria-checked") === "true" || x.getAttribute("aria-selected") === "true" || x.checked === true;
  const choice = (c) => c.matches("[role=radio], [role=tab], [role=option], input[type=radio]");
  // the name of a control: its aria-label, the element aria-labelledby points at, its option row, its own text, or the
  // text of the row it sits in (a switch whose label stands beside it); a choice adds its own label (a radio input's is
  // its <label>: the value alone is the same for every choice of some groups)
  const byId = (c) => (c.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
  const beside = (c) => { let el = own(c); for (let i = 0; i < 3 && el; i++, el = el.parentElement) { const t = el.textContent.trim(); if (t) return t; } return ""; };
  const name = (c) => (c.getAttribute("aria-label") || byId(c) || (c.closest(".sc-play-opt, .hm-field") ?? own(c)).textContent.trim() || beside(c) || c.tagName).trim().replace(/\\s+/g, " ").slice(0, 60)
    + (choice(c) ? " → " + ((c.matches("input") ? c.closest("label")?.textContent.trim() || c.getAttribute("aria-label") : c.textContent.trim()) || c.value || "").slice(0, 20) : "");
  const where = (c) => (c.closest(".sc-demo")?.querySelector(".sc-demo-title")?.textContent ?? c.closest(".hm-card")?.querySelector(".hm-card-title")?.textContent ?? "").trim();
  // use: flip a switch / checkbox, pick another option of a group, move a slider; returns an undo
  const fire = (c) => { c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true })); };
  const use = (c) => {
    if (c.matches("input[type=range]")) {
      // a drag: several input events through the range, as a pointer gives them; the slider must stay the same node
      const old = c.value, min = Number(c.min || 0), max = Number(c.max || 100), to = Number(old) === max ? min : max;
      for (let k = 1; k <= 4; k++) { c.value = String(Number(old) + ((to - Number(old)) * k) / 4); fire(c); }
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
  // numbers left out: a slider's label carries its value, which changes while it is tried
  const key = (c) => where(c) + " § " + name(c).replace(/[\\d.,]+/g, "#");
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
  // aria-orientation must match the layout: the items of a "horizontal" tablist / toolbar / radiogroup sit side by
  // side, those of a "vertical" one stacked (a class or attribute saying "horizontal" on a bar that stays vertical)
  const turned = () => [...root().querySelectorAll("[aria-orientation]")].filter((g) => !skip(g) && shown(g) && !g.matches("[role=slider], [role=separator], [role=scrollbar], input")).flatMap((g) => {
    const items = [...g.querySelectorAll("[role=tab], [role=radio], [role=option], [role=menuitem], button")].filter((x) => shown(x) && x.closest("[aria-orientation]") === g);
    if (items.length < 2) return [];
    const rs = items.map((x) => x.getBoundingClientRect());
    const dx = Math.max(...rs.map((r) => r.left)) - Math.min(...rs.map((r) => r.left)), dy = Math.max(...rs.map((r) => r.top)) - Math.min(...rs.map((r) => r.top));
    const hz = g.getAttribute("aria-orientation") === "horizontal";
    return (hz ? dy > dx : dx > dy) ? [(g.getAttribute("aria-label") || g.className || g.tagName) + " says " + (hz ? "horizontal" : "vertical") + " but its items are laid out " + (hz ? "vertically" : "horizontally")] : [];
  });
  // an option whose effect shows on the next interaction (a menu opened, a drawer opened, a message sent): the stage of
  // the demo is used — its popup triggers and the elements it marks with data-audit-try are pressed — and what that
  // shows is compared, after the option was changed and after it was put back. data-audit-try="toggle" is pressed
  // again to close, "contextmenu" is right-clicked; anything else is closed with Escape.
  const tryNext = async (c) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const stage = c.closest(".sc-play")?.querySelector(".sc-play-stage") ?? c.closest(".sc-demo");
    if (!stage) return null;
    const triggers = [...stage.querySelectorAll("[data-audit-try], [aria-haspopup]:not([aria-haspopup=false])")].filter((x) => shown(x) && !x.disabled).slice(0, 3);
    // resize handles (a splitter, a resizable sidebar): Home and End take them to their limits
    const handles = [...stage.querySelectorAll("[role=separator][tabindex]")].filter(shown).slice(0, 2);
    if (!triggers.length && !handles.length) return null;
    const out = [];
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    for (const hd of handles) { hd.focus(); for (const k of ["Home", "End"]) { key(hd, k); await wait(350); out.push(snap(c)); } }
    for (const t of triggers) {
      // data-audit-try="contextmenu": a right click (a context menu); else a click
      if (t.getAttribute("data-audit-try") === "contextmenu") { const r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); }
      else t.click();
      await wait(500);
      out.push(snap(c));
      if (t.getAttribute("data-audit-try") === "toggle") t.click();
      else (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await wait(450);
    }
    return out.join(" ~~ ");
  };
  window.__ca = { pending, snap, use, name, where, key, settle, turned, tryNext, tried: new Set() };
  return true;
})()`;

const { ev, errs, load, close } = await openHeadless({ base: flag("--base", null) });
const findings = [];
let total = 0;
for (const route of ROUTES) {
  await load(route, WIDTH);
  await ev(SETUP);
  // a page that did not open (a host without the page's file) has no controls: that must not pass as "0 controls"
  if (!(await ev(`!!document.querySelector("main")`))) { findings.push({ route, kind: "page", at: "", detail: "the page did not open (no <main>)" }); process.stdout.write("✖"); continue; }
  if (!(await ev("__ca.settle()"))) findings.push({ route, kind: "lazy", at: "", detail: "a lazy card was still loading after 6 s" });
  for (const t of (await ev("__ca.turned()")) ?? []) findings.push({ route, kind: "orientation", at: "", detail: t });
  let n = 0;
  for (; n < MAX_PER_PAGE; n++) {
    // the next control not tried yet: picked again each time, so controls that appear later are found too
    const info = await ev(`(() => { const c = __ca.pending()[0]; if (!c) return null; c.setAttribute("data-ca-done", ""); __ca.tried.add(__ca.key(c));
      c.scrollIntoView({ block: "center" }); return { name: __ca.name(c), where: __ca.where(c), key: __ca.key(c) }; })()`);
    if (!info) break;
    await sleep(150);
    // the control is focused and used; it must stay the same DOM node with the focus (a control rebuilt on every change
    // breaks a slider drag: the pointer and the focus go with the old node and the value moves one step at a time)
    const res = await ev(`(async () => { const c = [...document.querySelectorAll("[data-ca-done]")].find((x) => __ca.key(x) === ${JSON.stringify(info.key)}); if (!c) return { changed: true, kept: true };
      const before = __ca.snap(c); c.focus({ preventScroll: true }); const focused = document.activeElement === c;
      const undo = __ca.use(c); await new Promise((r) => setTimeout(r, 450)); const after = __ca.snap(c);
      const kept = c.isConnected && (!focused || document.activeElement === c || (document.activeElement !== document.body && document.activeElement !== null)); const turned = __ca.turned();
      let changed = before !== after;
      if (!changed) { const b = await __ca.tryNext(c); undo(); await new Promise((r) => setTimeout(r, 250)); const a = b === null ? null : await __ca.tryNext(c); changed = a !== b; }
      else { undo(); await new Promise((r) => setTimeout(r, 250)); }
      return { changed, kept, turned }; })()`, 60000);
    const changed = res?.changed;
    if (VERBOSE) console.log(`  ${changed === false || res?.kept === false ? "✖" : "✓"} ${route} [${info.where}] ${info.name}`);
    if (changed === false) findings.push({ route, kind: "dead-control", at: info.where, detail: info.name });
    for (const t of res?.turned ?? []) findings.push({ route, kind: "orientation", at: info.where, detail: `${info.name}: ${t}` });
    if (res?.kept === false) findings.push({ route, kind: "rebuilt-control", at: info.where, detail: `${info.name}: the control was rebuilt (or lost the focus) when used` });
  }
  total += n;
  if (n >= MAX_PER_PAGE) findings.push({ route, kind: "limit", at: "", detail: `more than ${MAX_PER_PAGE} controls: the page keeps adding them` });
  for (const e of new Set(errs)) findings.push({ route, kind: "console", at: "", detail: e });
  errs.length = 0;
  // --stream: a page's findings are printed as soon as the page is done (a long run can be acted on while it goes on)
  if (STREAM) for (const f of findings.filter((x) => x.route === route)) console.log(`✖ ${f.route}  ${f.kind}  ${f.at ? `[${f.at}] ` : ""}${f.detail}`);
  if (STREAM) console.log(`· ${route} done`);
  else process.stdout.write(findings.some((f) => f.route === route) ? "✖" : "·");
}
await close();
console.log("");
for (const f of findings) console.log(`✖ ${f.route}  ${f.kind}  ${f.at ? `[${f.at}] ` : ""}${f.detail}`);
console.log(findings.length ? `${findings.length} problems (${total} controls on ${ROUTES.length} pages)` : `✔ ${ROUTES.length} pages, ${total} controls: every control changes something`);
process.exit(findings.length ? 1 : 0);
