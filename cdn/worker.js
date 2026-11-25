// cdn.marchjs.com: MarchJS as browser modules (tools/build-cdn.js writes them, tools/cdn-deploy.js publishes them as
// the Worker's static assets). Every file is served by the assets layer straight away (free, no Worker run), with the
// headers of dist/_headers: CORS open, a version's files cached for a year. The Worker runs only
//  - for a version's entry file (march.js, run_worker_first in wrangler.jsonc): it notes which site loaded which version
//    (the Origin a module script sends, else the Referer's origin) in Analytics Engine, then serves the file;
//  - when no file matches: /latest/<file> is sent to the newest version's file (latest/ is not a copy: the assets of a
//    Worker are limited in number), and a version no longer kept (tools/cdn-deploy.js keeps the newest that fit) is sent
//    to the newest kept version of the same minor (0.3.4 → 0.3.17: same API), so an old link keeps working.
// Redirects are cached for five minutes; a module that arrives through one resolves its relative imports from where it
// landed. tools/cdn-usage.js reads the notes.
const ENTRY = /^\/(latest|\d+\.\d+\.\d+[\w.-]*)\/march\.js$/;
const VERSIONED = /^\/(latest|(\d+)\.(\d+)\.(\d+)[\w.-]*)\/(.*)$/;
const site = (req) => {
  const from = req.headers.get("Origin") ?? req.headers.get("Referer");
  if (!from || from === "null") return "(direct)";
  try { return new URL(from).host; } catch { return "(unknown)"; }
};
const num = (v) => v.split(/[.-]/).slice(0, 3).map(Number);
const newer = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

/** versions.json of the deploy ({ latest, versions }), read from the assets (once per Worker instance). */
let list = null;
async function versions(env, req) {
  if (!list) {
    const r = await env.ASSETS.fetch(new Request(new URL("/versions.json", req.url)));
    list = r.ok ? await r.json() : { latest: null, versions: [] };
  }
  return list;
}
/** Where a request with no file of its own goes, or null. */
async function target(env, req) {
  const url = new URL(req.url), m = VERSIONED.exec(url.pathname);
  if (!m) return null;
  const { latest, versions: kept } = await versions(env, req);
  if (m[1] === "latest") return latest ? `/${latest}/${m[5]}` : null;
  if (kept.includes(m[1])) return null; // a kept version without this file: a real 404
  // a version no longer kept: the newest kept one of the same minor
  const same = kept.filter((v) => { const [a, b] = num(v); return a === Number(m[2]) && b === Number(m[3]); });
  const best = same.reduce((a, v) => (a == null || newer(v, a) ? v : a), null);
  return best ? `/${best}/${m[5]}` : null;
}

export default {
  async fetch(req, env) {
    const res = await env.ASSETS.fetch(req);
    if (res.status === 404) {
      const to = await target(env, req);
      if (to) {
        const u = new URL(req.url); u.pathname = to;
        return new Response(null, { status: 302, headers: { Location: u.toString(), "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
      }
      return res;
    }
    const m = ENTRY.exec(new URL(req.url).pathname);
    if (m && res.ok && env.USAGE) {
      try {
        const host = site(req);
        env.USAGE.writeDataPoint({ indexes: [host], blobs: [host, m[1], String(req.cf?.country ?? "")], doubles: [1] });
      } catch { /* the file is served whatever the notes do */ }
    }
    return res;
  },
};
