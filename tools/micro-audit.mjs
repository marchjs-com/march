#!/usr/bin/env node
// Motion › Micro-interactions in headless Edge / Chrome, driven with real pointer and key input:
//   - ripple: on the "HADİ" card and the Kaydet / Paylaş buttons the ink starts at the pressed point, inside the
//     element, in its text colour; Enter starts it in the centre; the card is focusable (tabindex, role); ink goes away
//   - magnet, hover parallax (layers by depth) and spring press move, then settle back with nothing left inline or held
//   - state morph: 3 success and 3 error rounds, the Playground result switched in between; after each round the
//     button is exactly as it started (size, text, class, inline style, colour, no held animation)
// Usage: node examples/showcase/build.mjs && node tools/micro-audit.mjs   (exit 1 on a failure)
import { openHeadless, sleep } from "./lib/headless.mjs";

setTimeout(() => { console.error("✖ timed out"); process.exit(2); }, 10 * 60_000).unref();
const b = await openHeadless();
let fails = 0;
const check = (ok, what, extra = "") => { if (!ok) fails++; console.log(`${ok ? "✔" : "✖"} ${what}${extra ? ` (${extra})` : ""}`); };
await b.load("/motion/micro", 1280);
await b.ev(`(async () => { for (let i = 0; i < 40 && !document.querySelector(".sc-mo-save"); i++) await new Promise((r) => setTimeout(r, 250)) })()`);
await sleep(500);

const mouse = (type, x, y) => b.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
// scrolled into view first, measured once the scroll has settled
const center = async (sel) => (await b.ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center" })`), await sleep(300), b.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height } })()`));
// the newest ink of an element: its centre on screen, inside the element, colour, opacity
const INK = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}), ink = [...el.querySelectorAll(":scope > span[aria-hidden]")].pop(); if (!ink) return null;
  const r = el.getBoundingClientRect(), w = parseFloat(ink.style.width), cs = getComputedStyle(ink), box = ink.getBoundingClientRect();
  return { cx: r.left + parseFloat(ink.style.left) + w / 2, cy: r.top + parseFloat(ink.style.top) + w / 2, inside: box.width > 0 && ink.offsetParent === el,
    color: cs.backgroundColor === getComputedStyle(el).color, op: +cs.opacity } })()`;

// 1 · ripple
for (const [sel, name] of [[".sc-mo-ripple-card", "card"], [".sc-mo-micro .m-btn-primary", "Kaydet"], [".sc-mo-micro .m-btn-secondary", "Paylaş"]]) {
  const c = await center(sel); await sleep(150);
  const px = c.l + c.w * 0.25, py = c.t + c.h * 0.4;
  await mouse("mousePressed", px, py); await sleep(90);
  const ink = await b.ev(INK(sel));
  await mouse("mouseReleased", px, py);
  check(!!ink && Math.abs(ink.cx - px) < 1.5 && Math.abs(ink.cy - py) < 1.5 && ink.inside && ink.color && ink.op > 0.02, `ripple · ${name}: ink from the pressed point, inside, in the text colour`, JSON.stringify({ ink, px, py }));
  await sleep(1000);
  check(await b.ev(`!document.querySelector(${JSON.stringify(sel)}).querySelector(":scope > span[aria-hidden]")`), `ripple · ${name}: the ink is gone after it plays`);
}
const card = await b.ev(`(() => { const el = document.querySelector(".sc-mo-ripple-card"); return { tab: el.tabIndex, role: el.getAttribute("role") } })()`);
check(card.tab === 0 && card.role === "button", "ripple · card: focusable (tabindex 0, role button)", JSON.stringify(card));
for (const key of [["Enter", "Enter", 13], [" ", "Space", 32]]) {
  const c = await center(".sc-mo-ripple-card");
  await b.ev(`document.querySelector(".sc-mo-ripple-card").focus()`);
  await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: key[0], code: key[1], windowsVirtualKeyCode: key[2] });
  await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: key[0], code: key[1], windowsVirtualKeyCode: key[2] });
  await sleep(60);
  const ink = await b.ev(INK(".sc-mo-ripple-card"));
  check(!!ink && ink.inside && Math.abs(ink.cx - c.x) < 1.5 && Math.abs(ink.cy - c.y) < 1.5, `ripple · card: ${key[1]} starts it in the centre`, JSON.stringify(ink));
  await sleep(1000);
}

// what may stay on an element after an interaction: an inline transform or a running / held animation
const LEFT = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((el) => [el, ...el.querySelectorAll("*")]).flat().reduce((n, e) => n + (e.style.transform && e.style.transform !== "none" ? 1 : 0) + e.getAnimations().length, 0)`;
const MOVED = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => getComputedStyle(e).transform)`;

// 2 · magnet
{
  const c = await center(".sc-mo-magnet"); await sleep(150);
  // inside the round button (hit testing follows its border radius)
  await mouse("mouseMoved", c.x + c.w * 0.15, c.y + c.h * 0.15); await sleep(60);
  await mouse("mouseMoved", c.x + c.w * 0.25, c.y + c.h * 0.2); await sleep(150);
  const t = (await b.ev(MOVED(".sc-mo-magnet")))[0];
  check(t !== "none", "magnet: the button is pulled toward the pointer", t);
  await mouse("mouseMoved", 5, 5); await sleep(1200);
  check(!(await b.ev(LEFT(".sc-mo-magnet"))), "magnet: settles back, nothing inline or held");
}
// 3 · hover parallax
{
  const c = await center(".sc-mo-plx"); await sleep(150);
  await mouse("mouseMoved", c.x, c.y); await sleep(60);
  await mouse("mouseMoved", c.l + c.w * 0.9, c.t + c.h * 0.2); await sleep(150);
  const xs = await b.ev(`[...document.querySelectorAll(".sc-mo-plx [data-depth]")].map((e) => [+e.dataset.depth, new DOMMatrix(getComputedStyle(e).transform).m41])`);
  const sorted = [...xs].sort((a, c) => a[0] - c[0]);
  check(xs.length >= 4 && sorted.every((v, i) => i === 0 || v[1] >= sorted[i - 1][1]) && sorted.at(-1)[1] > sorted[0][1] + 1, "hover parallax: deeper layers shift more", JSON.stringify(xs));
  await mouse("mouseMoved", 5, 5); await sleep(2000);
  check(!(await b.ev(LEFT(".sc-mo-plx"))), "hover parallax: springs back, nothing inline or held");
}
// 4 · spring press
{
  const c = await center(".sc-mo-press"); await sleep(150);
  await mouse("mouseMoved", c.x, c.y);
  await mouse("mousePressed", c.x, c.y); await sleep(200);
  const s = await b.ev(`new DOMMatrix(getComputedStyle(document.querySelector(".sc-mo-press")).transform).a`);
  check(s < 0.99, "spring press: pressed, it shrinks", String(s));
  await mouse("mouseReleased", c.x, c.y); await sleep(2500);   // the spring's own length (~1.5 s)
  check(!(await b.ev(LEFT(".sc-mo-press"))), "spring press: released, back to its size, nothing held");
}

// 5 · state morph
const SAVE = `document.querySelector(".sc-mo-save")`;
const SNAP = `(() => { const el = ${SAVE}, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return { w: Math.round(r.width), h: Math.round(r.height), text: el.innerText.trim(), cls: el.className, style: el.getAttribute("style"), state: el.getAttribute("data-m-state"),
    bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow, radius: cs.borderRadius, held: el.getAnimations().length, busy: el.hasAttribute("aria-busy") } })()`;
// the Playground's "Sonuç" choice of this demo
const RESULT = (label) => `(() => { const demo = ${SAVE}.closest(".sc-motion-demo, section, article") ?? document; const all = [...document.querySelectorAll("button, [role=radio], label, option")]; const el = all.find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; if (el.tagName === "OPTION") { el.selected = true; el.parentElement.dispatchEvent(new Event("change", { bubbles: true })); } else el.click(); return true })()`;
await b.ev(`${SAVE}.scrollIntoView({ block: "center" })`); await sleep(300);
const first = await b.ev(SNAP);
for (const [i, result] of ["başarı", "hata", "başarı", "hata", "başarı", "hata"].entries()) {
  const switched = await b.ev(RESULT(result));
  if (!switched) { check(false, `state morph: the Playground result "${result}"`, "control not found"); break; }
  await sleep(200);
  await b.ev(`${SAVE}.click()`); await sleep(500);
  const busy = await b.ev(SNAP);
  await sleep(1300);
  const done = await b.ev(SNAP);
  await sleep(2600);
  const end = await b.ev(SNAP);
  const want = result === "başarı" ? "success" : "error";
  check(busy.state === "loading" && busy.w === busy.h && done.state === want && JSON.stringify(end) === JSON.stringify(first),
    `state morph, round ${i + 1} (${want}): circle, ${want}, then back exactly as it was`, JSON.stringify({ busy: [busy.state, busy.w, busy.h], done: done.state, end, first }).slice(0, 600));
}

check(!b.errs.length, "no console errors", b.errs.slice(0, 3).join(" | "));
await b.close();
console.log(fails ? `✖ ${fails} failure(s)` : "✔ micro-interactions respond and leave nothing behind");
process.exit(fails ? 1 : 0);
