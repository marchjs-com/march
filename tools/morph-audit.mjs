#!/usr/bin/env node
// Motion › Morph in headless Edge / Chrome (real WAAPI, where held end states show): every demo opens and closes
// 5 times, then once more with overlapping clicks, and each time the page is clean again:
//   - button → dialog: the dialog opens at full size with its content visible; after closing the button is visible
//     with its label and no effect, inline style or held animation stays on the dialog or its children
//   - card → page: the same for each of the three cards (every card back, visible, with its text)
//   - shared element and icon morphs: rapid clicks end on the last choice, with no animation left behind
// Usage: node examples/showcase/build.mjs && node tools/morph-audit.mjs   (exit 1 on a failure)
import { openHeadless, sleep } from "./lib/headless.mjs";

setTimeout(() => { console.error("✖ timed out"); process.exit(2); }, 10 * 60_000).unref();
const b = await openHeadless();
let fails = 0;
const check = (ok, what, extra = "") => { if (!ok) fails++; console.log(`${ok ? "✔" : "✖"} ${what}${extra ? ` (${extra})` : ""}`); };
await b.load("/motion/morph");
await b.ev(`(async () => { for (let i = 0; i < 40 && !document.querySelector(".sc-mo-dialog"); i++) await new Promise((r) => setTimeout(r, 250)) })()`);

// helpers in the page: what a morph may leave behind on an element tree
await b.ev(`window.__mo = {
  held: (el) => [el, ...el.querySelectorAll("*")].flatMap((e) => e.getAnimations()).length,
  styled: (el) => [el, ...el.querySelectorAll("*")].filter((e) => ["transform", "clip-path", "background-color", "opacity"].some((k) => e.style.getPropertyValue(k))).length,
  shown: (el) => !el.hidden && getComputedStyle(el).visibility === "visible" && el.getBoundingClientRect().width > 0,
  open: (el, min) => !el.hidden && el.getBoundingClientRect().width >= min && [...el.children].every((c) => +getComputedStyle(c).opacity > 0.99),
}; true`);
const settle = () => sleep(1300);

// 1 · button → dialog
const DLG = `document.querySelector(".sc-mo-dialog")`, TRIG = `document.querySelector(".sc-mo-box [aria-haspopup=dialog]")`;
const closeDlg = `[...${DLG}.querySelectorAll("button")].find((x) => x.textContent.trim() === "Vazgeç").click()`;
for (let i = 1; i <= 5; i++) {
  await b.ev(`${TRIG}.click()`); await settle();
  const o = await b.ev(`({ open: __mo.open(${DLG}, ${TRIG}.getBoundingClientRect().width * 1.5), held: __mo.held(${DLG}) })`);
  check(o.open && !o.held, `button → dialog, round ${i}: the dialog opens with its content`, JSON.stringify(o));
  await b.ev(closeDlg); await settle();
  const c = await b.ev(`({ hidden: ${DLG}.hidden, btn: __mo.shown(${TRIG}), label: ${TRIG}.textContent.trim(), held: __mo.held(${DLG}) + __mo.held(${TRIG}), styled: __mo.styled(${DLG}) })`);
  check(c.hidden && c.btn && c.label === "Yeni etkinlik" && !c.held && !c.styled, `button → dialog, round ${i}: closed clean, the button is back with its label`, JSON.stringify(c));
}
// overlapping: close, reopen mid-shrink, close twice in a row
await b.ev(`${TRIG}.click()`); await settle();
await b.ev(`(async () => { ${closeDlg}; await new Promise((r) => setTimeout(r, 120)); ${TRIG}.click(); ${DLG}.querySelector("h3").click() })()`); await settle();
check(await b.ev(`__mo.open(${DLG}, 200) && !__mo.held(${DLG})`), "button → dialog: a click during the shrink keeps a clean open dialog");
await b.ev(`(() => { ${closeDlg}; ${closeDlg} })()`); await settle();
check(await b.ev(`${DLG}.hidden && __mo.shown(${TRIG}) && !__mo.held(${DLG}) && !__mo.styled(${DLG})`), "button → dialog: a double close ends clean");

// 2 · card → page
const PAGE = `document.querySelector(".sc-mo-page")`, CARDS = `[...document.querySelectorAll(".sc-mo-card")]`;
const back = `[...${PAGE}.querySelectorAll("button")].find((x) => x.textContent.trim() === "Geri").click()`;
for (let i = 1; i <= 5; i++) {
  for (let k = 0; k < 3; k++) {
    await b.ev(`${CARDS}[${k}].click()`); await settle();
    const o = await b.ev(`({ open: __mo.open(${PAGE}, ${CARDS}[${k}].getBoundingClientRect().width * 1.2), held: __mo.held(${PAGE}) })`);
    await b.ev(back); await settle();
    const c = await b.ev(`({ hidden: ${PAGE}.hidden, cards: ${CARDS}.map((x) => __mo.shown(x) && x.innerText.trim().length > 10), held: __mo.held(${PAGE}), styled: __mo.styled(${PAGE}) + ${CARDS}.filter((x) => x.style.visibility).length })`);
    if (i === 1 || i === 5 || !o.open || !c.hidden || c.cards.includes(false) || c.held || c.styled)
      check(o.open && !o.held && c.hidden && !c.cards.includes(false) && !c.held && !c.styled, `card ${k + 1} → page, round ${i}: opens, closes clean, every card back with its text`, JSON.stringify({ o, c }));
  }
}
// overlapping: back, then another card mid-shrink
await b.ev(`${CARDS}[0].click()`); await settle();
await b.ev(`(async () => { ${back}; await new Promise((r) => setTimeout(r, 100)); ${CARDS}[1].click(); ${CARDS}[2].click() })()`); await settle();
await b.ev(`(() => { const p = ${PAGE}; if (!p.hidden) [...p.querySelectorAll("button")].find((x) => x.textContent.trim() === "Geri").click() })()`); await settle();
const cc = await b.ev(`({ hidden: ${PAGE}.hidden, cards: ${CARDS}.map((x) => __mo.shown(x)), held: __mo.held(${PAGE}), styled: __mo.styled(${PAGE}) })`);
check(cc.hidden && !cc.cards.includes(false) && !cc.held && !cc.styled, "card → page: clicks during the shrink end clean, every card visible", JSON.stringify(cc));

// 3 · shared element: rapid picks end on the last one
await b.ev(`(async () => { const t = [...document.querySelectorAll(".sc-mo-thumb")]; for (const i of [1, 2, 3, 0, 2, 1, 3]) { t[i].click(); await new Promise((r) => setTimeout(r, 40)) } })()`); await settle();
const sh = await b.ev(`({ who: document.querySelector(".sc-mo-big").getAttribute("aria-label"), held: __mo.held(document.querySelector(".sc-mo-shared")), styled: __mo.styled(document.querySelector(".sc-mo-shared")) })`);
check(sh.who === "Deniz" && !sh.held && !sh.styled, "shared element: rapid picks end on the last one, nothing held", JSON.stringify(sh));

// 4 · icons: 5 rapid toggles flip each one, 5 more bring back exactly the outline it started with (the last wins)
const ICONS = `[...document.querySelectorAll(".sc-mo-iconbtn")].map((x) => [x.getAttribute("aria-pressed"), x.querySelector("path").getAttribute("d")])`;
const toggle5 = `(async () => { const bs = [...document.querySelectorAll(".sc-mo-iconbtn")]; for (let r = 0; r < 5; r++) { for (const x of bs) x.click(); await new Promise((r) => setTimeout(r, 60)) } })()`;
const ic0 = await b.ev(ICONS);
await b.ev(toggle5); await settle();
const ic1 = await b.ev(ICONS);
await b.ev(toggle5); await settle();
const ic2 = await b.ev(ICONS);
check(ic1.every(([p, d], i) => p !== ic0[i][0] && d !== ic0[i][1]) && ic2.every(([p, d], i) => p === ic0[i][0] && d === ic0[i][1]), "icon morph: rapid toggles end on the last state's exact outline", JSON.stringify({ ic0, ic1, ic2 }).slice(0, 300));

check(!b.errs.length, "no console errors", b.errs.slice(0, 3).join(" | "));
await b.close();
console.log(fails ? `✖ ${fails} failure(s)` : "✔ morph demos open and close clean");
process.exit(fails ? 1 : 0);
