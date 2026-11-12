// Headless Chromium (Edge / Chrome) over CDP for the browser audits: serves examples/showcase/dist (unless a base URL
// is given), starts the browser with a throwaway profile and returns small helpers.
//
//   const b = await openHeadless({ base })        b.base, b.send(method, params), b.ev(expr), b.errs, b.load(route, w)
//   await b.close()
// Browser: $BROWSER_PATH, else Edge / Chrome in the usual places.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `--name value` from argv, or the default. */
export const flag = (argv, k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

/** The showcase's page list (nav.ts). */
export function showcaseRoutes() {
  const navFile = join(ROOT, "examples/showcase/src/nav.ts");
  return existsSync(navFile) ? [...readFileSync(navFile, "utf8").matchAll(/path: "([^"]+)"/g)].map((m) => m[1]) : ["/"];
}

/** Every showcase page: the top-level list (nav.ts), the pages under a wildcard route (nav-meta.ts › SUB_PAGES:
 * /motion/svg…) and the router demo's own pages. */
export function allShowcaseRoutes() {
  const read = (f) => { const p = join(ROOT, "examples/showcase/src", f); return existsSync(p) ? readFileSync(p, "utf8") : ""; };
  const sub = read("nav-meta.ts").match(/SUB_PAGES[^=]*=\s*\[([\s\S]*?)\n\]/)?.[1] ?? "";
  const extra = read("routes.ts").includes('"/navigation/router"') ? ["/navigation/router"] : [];
  return [...new Set([...showcaseRoutes(), ...[...sub.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]), ...extra])];
}

export async function openHeadless({ base = null } = {}) {
  let server;
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
  /** Open a showcase route at a width, from a fresh reload. */
  const load = async (route, w = 1440) => {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 });
    await send("Page.navigate", { url: `${base}/#${route}` }); await sleep(250); await send("Page.reload"); await sleep(1800);
  };
  const close = async () => { ws.close(); browser.kill(); server?.close(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { base, send, ev, errs, load, close };
}
