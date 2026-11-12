#!/usr/bin/env node
// Motion engine check in headless Edge / Chrome (CDP), served with the showcase's strict CSP:
//   - the Animation engine page and the Motion page load without console errors or CSP violations
//   - "One engine": the DOM card runs on WAAPI, the canvas and WebGL lanes draw; "Stop all" freezes all three and the
//     pure CSS spinner, resume starts them again; the global speed reaches WAAPI and CSS animations
//   - the 200-item stagger: start time, dropped frames and long tasks
// Usage: node examples/showcase/build.mjs && node tools/motion-audit.mjs   (exit 1 on a failure)
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(ROOT, "examples/showcase/dist");
if (!existsSync(dist)) { console.error("✖ build the showcase first: node examples/showcase/build.mjs"); process.exit(2); }
const CSP = /export const CSP = "([^"]+)"/.exec(readFileSync(join(ROOT, "examples/showcase/build.mjs"), "utf8"))[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error("✖ timed out"); process.exit(2); }, 120_000).unref();
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };
const server = createServer((req, res) => {
  let p = resolve(dist, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream", "content-security-policy": CSP });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const exe = [process.env.BROWSER_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((p) => existsSync(p));
if (!exe) { console.error("✖ Edge/Chrome not found (set BROWSER_PATH)"); process.exit(2); }
const port = 9300 + Math.floor(Math.random() * 500), profile = mkdtempSync(join(tmpdir(), "march-motion-"));
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
let target;
for (let i = 0; i < 80 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const wait = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
  if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value ?? a.description).join(" "));
  if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errors.push(d.params.entry.text);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

let fails = 0;
const check = (ok, what, extra = "") => { if (!ok) fails++; console.log(`${ok ? "✔" : "✖"} ${what}${extra ? ` (${extra})` : ""}`); };

for (const route of ["/", "/motion", "/animation"]) {
  errors.length = 0;
  await send("Page.navigate", { url: `${base}/#${route}` }); await sleep(300); await send("Page.reload"); await sleep(2500);
  check(!errors.length, `${route}: no console errors / CSP violations`, errors.slice(0, 3).join(" | "));
}

// the Animation engine page
const card = `document.querySelector(".sc-an-card")`;
const state = await ev(`(() => { const a = ${card}?.getAnimations() ?? []; return { n: a.length, ps: a[0]?.playState, css: document.querySelector(".sc-an-spinner")?.getAnimations()[0]?.playState } })()`);
check(state.n >= 1 && state.ps === "running", "One engine: the DOM card runs on WAAPI", JSON.stringify(state));
const pixels = `(() => [...document.querySelectorAll(".sc-an-canvas")].map((c) => { try { return c.toDataURL().length + ":" + c.toDataURL().slice(-48) } catch (e) { return "x" } }))()`;
const p1 = await ev(pixels); await sleep(400); const p2 = await ev(pixels);
check(p1[0] !== p2[0], "One engine: the canvas wave is drawn every frame");
check(p1[1] !== p2[1], "One engine: the WebGL gradient is drawn every frame");
// Stop all
await ev(`[...document.querySelectorAll("button")].find((b) => b.dataset.an === "pause-all").click(); true`);
await sleep(300);
const paused = await ev(`(() => ({ card: ${card}.getAnimations()[0]?.playState, css: document.querySelector(".sc-an-spinner").getAnimations()[0]?.playState }))()`);
const q1 = await ev(pixels); await sleep(400); const q2 = await ev(pixels);
check(paused.card === "paused" && paused.css === "paused", "Stop all pauses WAAPI and the pure CSS animation", JSON.stringify(paused));
check(q1[0] === q2[0] && q1[1] === q2[1], "Stop all freezes the canvas and WebGL lanes");
await ev(`[...document.querySelectorAll("button")].find((b) => b.dataset.an === "pause-all").click(); true`);
await sleep(300);
const resumed = await ev(`(() => ({ card: ${card}.getAnimations()[0]?.playState, css: document.querySelector(".sc-an-spinner").getAnimations()[0]?.playState }))()`);
check(resumed.card === "running" && resumed.css === "running", "Resume starts them again", JSON.stringify(resumed));
// global speed reaches WAAPI and CSS
const rate = await ev(`(async () => { const s = document.querySelector(".sc-an-control input[type=range]"); s.value = "0.5"; s.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 100)); const r = { card: ${card}.getAnimations()[0].playbackRate, css: document.querySelector(".sc-an-spinner").getAnimations()[0].playbackRate }; s.value = "1"; s.dispatchEvent(new Event("input", { bubbles: true })); return r })()`);
check(rate.card === 0.5 && rate.css === 0.5, "Global speed 0.5× reaches WAAPI and CSS animations", JSON.stringify(rate));
// the 200-item stagger
await ev(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.dataset.an === "stagger-run"); b.scrollIntoView(); b.click(); return true })()`);
let res = null;
for (let i = 0; i < 40 && !res; i++) { await sleep(150); res = await ev(`(() => { const h = document.querySelector(".sc-an-dots"); return h?.dataset.anDrops != null ? { drops: +h.dataset.anDrops, long: +h.dataset.anLong, start: +h.dataset.anStart } : null })()`); }
check(!!res, "200-item stagger ran", JSON.stringify(res));
if (res) {
  check(res.long === 0, "200-item stagger: no long task", `long tasks ${res.long}`);
  check(res.start < 50, "200-item stagger: started under 50 ms", `${res.start} ms`);
  console.log(`  dropped frames during the stagger: ${res.drops} (headless, software rendering)`);
}
check(!errors.length, "/animation: no errors after the interactions", errors.slice(0, 3).join(" | "));

ws.close(); browser.kill(); server.close(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log(fails ? `✖ ${fails} check(s) failed` : "✔ motion engine checks passed");
process.exit(fails ? 1 : 0);
