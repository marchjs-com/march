#!/usr/bin/env node
// Every showcase menu page opens, in headless Edge / Chrome, on every kind of host (docs/hosting.md):
//   rewrite  a host with a rewrite rule (Cloudflare Pages / Netlify: /* → /404.html 200)
//   static   no rewrites at all (GitHub Pages, S3, a plain file server: 404.html with status 404)
//   subdir   the same in a sub-folder (/march/, as devs.example.com/march/)
//   files    dist/ opened from files (file://: the router falls back to #/ addresses)
// In each: every page of nav.ts opened directly by its address and reloaded (same page, same address); every page
// reached by a click on its side menu link, then back and forward through them; an address with params
// (/navigation/router/item/3, served by 404.html) and the page transition variants (/motion/pages/<variant>); an old
// hash link (#/motion) becomes /motion. No "not found" view, no empty page, no console error.
// Usage: node examples/showcase/build.mjs && node tools/menu-audit.mjs [--modes rewrite,static,subdir,files] [--verbose]
import { openHeadless, showcaseRoutes, sleep, flag } from "./lib/headless.mjs";

const MODES = flag(process.argv, "--modes", "rewrite,static,subdir,files").split(",");
const pages = showcaseRoutes();
const variants = ["circle", "curtain", "blinds"].map((v) => `/motion/pages/${v}`);
const DYNAMIC = "/navigation/router/item/3";
setTimeout(() => { console.error("✖ timed out"); process.exit(2); }, 60 * 60_000).unref();

let fails = 0, checks = 0;
const check = (ok, what, extra = "") => { checks++; if (!ok) fails++; if (!ok || process.argv.includes("--verbose")) console.log(`${ok ? "✔" : "✖"} ${what}${extra ? ` (${extra})` : ""}`); };

for (const mode of MODES) {
  const files = mode === "files";
  const b = await openHeadless({ serve: mode === "rewrite" ? "rewrite" : "static", prefix: mode === "subdir" ? "/march" : "", files });
  const root = new URL(b.urlOf("/")).pathname.replace(/index\.html$/, "");
  // the route an address names: #/… (from files), else the path under the root
  const ROUTE_OF = `((u) => /^#\\//.test(u.hash) ? u.hash.slice(1).split("?")[0] : ((u.pathname.startsWith(${JSON.stringify(root)}) ? "/" + u.pathname.slice(${root.length}) : u.pathname).replace(/(\\/index\\.html?)?\\/*$/, "") || "/"))`;
  // what the page shows: its route, a not-found view, the length of its text
  const STATE = `(() => { const m = document.querySelector("main") ?? document.body; const txt = m.innerText;
    const nf = /Sayfa bulunamadı/.test(txt) || [...m.querySelectorAll(".hm-empty")].some((e) => /^(Not found|Bulunamadı)\\.?$/.test(e.textContent.trim()));
    return { nf, len: txt.trim().length, route: ${ROUTE_OF}(location), href: location.href } })()`;
  /** Wait until the page shows `route` (twice in a row: the old page can stay on screen while the new one loads). */
  const settle = async (route) => {
    let s, streak = 0;
    for (let i = 0; i < 80 && streak < 2; i++) { await sleep(250); s = await b.ev(STATE); streak = s && s.route === route && !s.nf && s.len >= 40 ? streak + 1 : 0; }
    return s ?? { route: "?", nf: false, len: 0, href: "" };
  };
  const why = (s, route) => (s.route !== route ? `shows ${s.route}` : s.nf ? "not found view" : s.len < 40 ? "empty page" : b.errs.slice(0, 2).join(" | "));
  const ok = (s, route) => s.route === route && !s.nf && s.len >= 40 && !b.errs.length;
  const open = (url) => b.send("Page.navigate", { url });
  const tag = `[${mode}]`;
  console.log(`${tag} ${b.urlOf("/")}`);

  // 1. directly by its address, then a reload
  for (const p of pages) {
    b.errs.length = 0;
    await open(b.urlOf(p));
    let s = await settle(p);
    check(ok(s, p), `${tag} ${p}: opens directly`, why(s, p));
    const before = s.href;
    b.errs.length = 0;
    await b.send("Page.reload");
    await sleep(300);
    s = await settle(p);
    check(ok(s, p) && s.href === before, `${tag} ${p}: reload keeps the page`, s.href !== before ? `address ${s.href}` : why(s, p));
  }

  // 2. an address with params and the transition variants: no file of their own (404.html, or #/ from files)
  for (const p of [DYNAMIC, ...variants]) {
    b.errs.length = 0;
    await open(files ? `${b.urlOf("/")}#${p}` : `${b.base}${p}`);
    const s = await settle(p);
    check(ok(s, p), `${tag} ${p}: opens directly (no file of its own)`, why(s, p));
  }

  // 3. an old hash link
  if (!files) {
    b.errs.length = 0;
    await open(`${b.base}/#/motion`);
    const s = await settle("/motion");
    check(ok(s, "/motion") && !s.href.includes("#"), `${tag} /#/motion: becomes /motion`, s.href.includes("#") ? `address ${s.href}` : why(s, "/motion"));
  }

  // 4. by a menu click from page to page, then back and forward through the last ones
  await open(b.urlOf("/start"));
  await settle("/start");
  const visited = ["/start"];
  for (const p of pages) {
    if (p === "/" || p === "/start") continue;
    b.errs.length = 0;
    const clicked = await b.ev(`(() => { const a = [...document.querySelectorAll("nav a[href]")].find((a) => ${ROUTE_OF}(new URL(a.getAttribute("href"), location.href)) === ${JSON.stringify(p)}); if (!a) return false; a.click(); return true })()`);
    if (!clicked) { check(false, `${tag} ${p}: a side menu link`, "no link"); continue; }
    const s = await settle(p);
    check(ok(s, p), `${tag} ${p}: opens from the menu`, why(s, p));
    visited.push(p);
  }
  const from = Math.max(0, visited.length - 6);
  for (let i = visited.length - 2; i >= from; i--) {
    b.errs.length = 0;
    await b.ev("history.back()");
    const s = await settle(visited[i]);
    check(ok(s, visited[i]), `${tag} back to ${visited[i]}`, why(s, visited[i]));
  }
  for (let i = from + 1; i <= Math.min(visited.length - 1, from + 3); i++) {
    b.errs.length = 0;
    await b.ev("history.forward()");
    const s = await settle(visited[i]);
    check(ok(s, visited[i]), `${tag} forward to ${visited[i]}`, why(s, visited[i]));
  }
  await b.close();
}

console.log(fails ? `✖ ${fails} of ${checks} check(s) failed` : `✔ ${checks} checks: ${pages.length} menu pages open directly, on reload, from the menu and with back/forward (${MODES.join(", ")})`);
process.exit(fails ? 1 : 0);
