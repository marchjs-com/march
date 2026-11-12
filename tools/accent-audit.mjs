#!/usr/bin/env node
// Accent audit (headless Edge / Chrome): with the app accent set to brand-green, no interactive element of the showcase may
// still be drawn in the HADİ orange (rgb 242,128,31), unless it asked for orange (color="brand-orange", colors="brand")
// or shows a theme / brand sample on purpose. Catches components that read a fixed brand token instead of the accent.
//   node tools/accent-audit.mjs [--routes /,/forms]     (serves examples/showcase/dist itself)
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const navFile = join(ROOT, "examples/showcase/src/nav.ts");
const ROUTES = flag("--routes", null)?.split(",") ?? [...readFileSync(navFile, "utf8").matchAll(/path: "([^"]+)"/g)].map((m) => m[1]);
const dist = join(ROOT, "examples/showcase/dist");
if (!existsSync(dist)) { console.error("✖ examples/showcase/dist is missing: run node examples/showcase/build.mjs first"); process.exit(2); }
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
const server = createServer((req, res) => {
  let p = resolve(dist, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" }); res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const exe = [process.env.BROWSER_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((p) => existsSync(p));
if (!exe) { console.error("✖ Edge/Chrome not found (set BROWSER_PATH)"); process.exit(2); }
const port = 9300 + Math.floor(Math.random() * 500), profile = mkdtempSync(join(tmpdir(), "march-accent-"));
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "about:blank"], { stdio: "ignore" });
let target;
for (let i = 0; i < 80 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const wait = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${base}/` }); await sleep(400);
await ev(`localStorage.setItem("hm.colorTheme", "hadi"); localStorage.setItem("hm.accent", JSON.stringify("brand-green")); true`);

const SCAN = `(() => {
  const ORANGE = "rgb(242, 128, 31)";
  const INTERACTIVE = "button, a[href], input, select, textarea, [role=tab], [role=radio], [role=switch], [role=checkbox], [role=option], .hm-check-box, .hm-switch, .hm-progress2-fill, .hm-loading, .hm-ring-value, .hm-sb-item, .hm-tab, .hm-segment, .hm-slider";
  // allowed on purpose: explicit orange, brand multicolor, theme previews / swatches, brand color samples, charts
  const ALLOWED = '[data-hm-color="brand-orange"], [data-hm-color="cat-1"], [data-hm-theme], .hm-swatch, .sc-brand, .sc-brands, .sc-ribbon, .hm-chart, .sc-cats, .sc-cat, svg.hm-ring';
  const hits = [];
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (el.closest(ALLOWED) || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    for (const p of ["backgroundColor", "borderTopColor", "color", "accentColor", "outlineColor", "stroke", "fill"]) {
      if (cs[p] === ORANGE) { hits.push((el.className?.baseVal ?? el.className ?? el.tagName).toString().slice(0, 60) + " · " + p); break; }
    }
  }
  return [...new Set(hits)];
})()`;
let total = 0;
for (const route of ROUTES) {
  await send("Page.navigate", { url: `${base}/#${route}` }); await sleep(250); await send("Page.reload"); await sleep(2200);
  const accentOn = await ev(`document.documentElement.getAttribute("data-hm-accent")`);
  const hits = await ev(SCAN);
  total += hits.length;
  console.log(`${hits.length ? "✖" : "✔"} ${route} (accent ${accentOn})${hits.length ? `\n   ${hits.join("\n   ")}` : ""}`);
}
ws.close(); browser.kill(); server.close(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log(total ? `${total} element(s) ignore the accent` : "✔ every interactive element follows the accent");
process.exit(total ? 1 : 0);
