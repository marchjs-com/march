// cdn.marchjs.com: MarchJS as browser modules (tools/build-cdn.js writes them, tools/cdn-deploy.js publishes them as
// the Worker's static assets). Every file is served by the assets layer straight away (free, no Worker run), with the
// headers of dist/_headers: CORS open, a version's files cached for a year, latest/ for five minutes. The Worker runs
// only for a version's entry file (march.js, run_worker_first in wrangler.jsonc): it notes which site loaded which
// version (the Origin a module script sends, else the Referer's origin) in Analytics Engine, then serves the file.
// tools/cdn-usage.js reads the notes.
const ENTRY = /^\/(latest|\d+\.\d+\.\d+[\w.-]*)\/march\.js$/;
const site = (req) => {
  const from = req.headers.get("Origin") ?? req.headers.get("Referer");
  if (!from || from === "null") return "(direct)";
  try { return new URL(from).host; } catch { return "(unknown)"; }
};

export default {
  async fetch(req, env) {
    const res = await env.ASSETS.fetch(req);
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
