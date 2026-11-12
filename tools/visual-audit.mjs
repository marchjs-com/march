#!/usr/bin/env node
// Visual audit of the showcase (or any March app) in a headless Chromium browser (Edge / Chrome) over CDP.
// For every page × width it reports:
//   page-overflow   the page scrolls sideways
//   overflow        an element's content is wider than its box and spills out (overflow: visible)
//   broken-word     a word is split across lines (letter-by-letter wrapping, overflow-wrap: anywhere in a narrow box)
//   uneven-row      cards in the same Grid row have different heights
//   overlap         neighbouring items of a flex row draw on top of each other
//   double-mount    after in-app navigation (menu clicks, back / forward) more than one app shell or page heading
//   console         a script error
//
//   node tools/visual-audit.mjs                      builds nothing; serves examples/showcase/dist itself
//   node tools/visual-audit.mjs --base http://127.0.0.1:5181 --widths 320,390 --routes /,/yerlesim
// Exit code 1 when anything is found. Browser: $BROWSER_PATH, else Edge / Chrome in the usual places.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const WIDTHS = flag("--widths", "320,390,768,1024,1440").split(",").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- routes: the showcase's page list (nav.ts), or --routes
const navFile = join(ROOT, "examples/showcase/src/nav.ts");
const ROUTES = flag("--routes", null)?.split(",") ?? (existsSync(navFile) ? [...readFileSync(navFile, "utf8").matchAll(/path: "([^"]+)"/g)].map((m) => m[1]) : ["/"]);
// extra states per route: [label, script run after load]
const STATES = {
  "/layout": [["container 50%", `(() => { const s = document.querySelectorAll("input[type=range]")[1]; s.value = "50"; s.dispatchEvent(new Event("input", { bubbles: true })); })()`],
    ["container 30%, 6 columns", `(() => { const s = document.querySelectorAll("input[type=range]")[1]; s.value = "30"; s.dispatchEvent(new Event("input", { bubbles: true })); [...document.querySelectorAll("[role=radio]")].find((b) => b.textContent.trim() === "6")?.click(); })()`]],
};

// ---- server (unless --base)
let base = flag("--base", null), server;
if (!base) {
  const dist = join(ROOT, "examples/showcase/dist");
  if (!existsSync(dist)) { console.error("✖ examples/showcase/dist is missing: run node examples/showcase/build.mjs first"); process.exit(2); }
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
  server = createServer((req, res) => {
    let p = resolve(dist, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
    res.end(readFileSync(p));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
}

// ---- browser
const CANDIDATES = [process.env.BROWSER_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
if (!exe) { console.error("✖ Edge/Chrome not found (set BROWSER_PATH)"); process.exit(2); }
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "march-audit-"));
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
let target;
for (let i = 0; i < 80 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const wait = new Map(); const errs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
  else if (d.method === "Runtime.exceptionThrown") errs.push(d.params.exceptionDetails?.exception?.description?.split("\n")[0]);
  else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errs.push(d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");

// ---- the in-page scan
const SCAN = `(() => {
  const out = [];
  const name = (el) => { let s = el.tagName.toLowerCase(); const c = [...el.classList].filter((x) => !/^is-/.test(x)).slice(0, 2).join("."); return c ? s + "." + c : s; };
  const where = (el) => { const p = []; for (let e = el; e && e !== document.body && p.length < 3; e = e.parentElement) p.unshift(name(e)); return p.join(" > "); };
  const skip = (el) => !!el.closest("svg, canvas, [aria-hidden=true], .hm-sr-only, pre, code, .hm-fx-fill, .hm-overlay[hidden], [data-audit-skip]");
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(["page-overflow", "html", de.scrollWidth + " > " + de.clientWidth]);
  for (const el of document.body.querySelectorAll("*")) {
    if (skip(el) || !shown(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline" || cs.display === "contents" || cs.overflowX !== "visible") continue;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
      // a spill that an ancestor scrolls or clips on purpose is fine; report only what actually leaves the box
      const kids = [...el.children].filter((k) => shown(k) && getComputedStyle(k).position !== "absolute" && getComputedStyle(k).position !== "fixed");
      const r = el.getBoundingClientRect();
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (text || kids.some((k) => { const kr = k.getBoundingClientRect(); return kr.right > r.right + 2 || kr.left < r.left - 2; })) out.push(["overflow", where(el), el.scrollWidth + " > " + el.clientWidth]);
    }
    if (/flex/.test(cs.display) && cs.flexDirection.startsWith("row")) {
      const kids = [...el.children].filter((k) => shown(k) && !skip(k) && getComputedStyle(k).position === "static" && parseFloat(getComputedStyle(k).marginInlineStart) >= 0 && getComputedStyle(k).animationName === "none"); // spinning boxes change size
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) out.push(["overlap", where(kids[i]), Math.round(w) + "×" + Math.round(h)]);
      }
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || skip(p) || !shown(p) || /^(pre|nowrap)/.test(getComputedStyle(p).whiteSpace) && getComputedStyle(p).whiteSpace !== "pre-wrap") continue;
    for (const m of n.textContent.matchAll(/[\\p{L}\\p{N}]{2,}/gu)) {
      range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top / 3)));
      if (tops.size > 1) { out.push(["broken-word", where(p), m[0]]); break; }
    }
  }
  for (const g of document.querySelectorAll(".hm-grid")) {
    if (skip(g) || !shown(g)) continue;
    const rows = new Map();
    for (const k of g.children) { if (!shown(k)) continue; const r = k.getBoundingClientRect(); const key = Math.round(r.top); (rows.get(key) ?? rows.set(key, []).get(key)).push(r.height); }
    for (const hs of rows.values()) if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 2) { out.push(["uneven-row", where(g), hs.map(Math.round).join("/")]); break; }
  }
  return out;
})()`;

const findings = [];
for (const route of ROUTES) for (const w of WIDTHS) for (const [label, script] of [["", null], ...(STATES[route] ?? [])]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: `${base}/#${route}` }); await sleep(250); await send("Page.reload"); await sleep(1800);
  if (script) { await ev(script); await sleep(700); }
  await ev(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 900)); })()`);
  const found = (await ev(SCAN)) ?? [];
  const seen = new Set();
  for (const [kind, at, detail] of found) { const key = kind + at; if (seen.has(key)) continue; seen.add(key); findings.push({ route, w, state: label, kind, at, detail }); }
  for (const e of new Set(errs)) findings.push({ route, w, state: label, kind: "console", at: "", detail: e });
  errs.length = 0;
  process.stdout.write(found.length ? "✖" : "·");
}
// double mount: navigate through every page inside the app (menu clicks, then back / forward), without reloading.
// After each step there must be exactly one app shell and one page heading (a second copy of the app would add both).
{
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base + "/#/" }); await sleep(250); await send("Page.reload"); await sleep(1800);
  const COUNT = "(() => ({ shells: document.querySelectorAll('.hm-app-shell, .hm-shell').length, h1: document.querySelectorAll('h1').length, roots: document.querySelectorAll('#app > :not(.hm-nav-bar)').length }))()";
  const verify = async (step) => {
    const c = await ev(COUNT);
    if (!c || c.shells !== 1 || c.h1 !== 1 || c.roots !== 1) findings.push({ route: step, w: 1440, state: "navigation", kind: "double-mount", at: "#app", detail: JSON.stringify(c) });
    for (const e of new Set(errs)) findings.push({ route: step, w: 1440, state: "navigation", kind: "console", at: "", detail: e });
    errs.length = 0;
  };
  for (const route of [...ROUTES.slice(1), ROUTES[0]]) {
    await ev("(() => { const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href') === '#" + route + "' || x.getAttribute('href').endsWith('#" + route + "')); if (a) a.click(); else location.hash = '" + route + "'; return 1; })()");
    await sleep(900); await verify(route);
  }
  for (const dir of ["back", "back", "forward"]) { await ev("history." + dir + "()"); await sleep(700); await verify(dir); }
  process.stdout.write("·");
}
ws.close(); browser.kill(); server?.close(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log("");
for (const f of findings) console.log(`✖ ${f.route} @${f.w}${f.state ? ` (${f.state})` : ""}  ${f.kind}  ${f.at}  ${f.detail}`);
console.log(findings.length ? `${findings.length} problems` : `✔ ${ROUTES.length} pages × ${WIDTHS.length} widths: no overflow, broken words, uneven cards, overlap or double mount`);
process.exit(findings.length ? 1 : 0);
