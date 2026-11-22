#!/usr/bin/env node
// Code freeze of components (docs/freeze.md). A frozen component's files (its folder under src/components) are recorded in docs/freeze.json with a digest; its meta.ts says `frozen: "<date>"`.
// test/freeze.test.js fails when a frozen component's files change while the record stays as it was.
//   node tools/freeze.mjs status                          how many are frozen; the ones that are not
//   node tools/freeze.mjs check                           every frozen component against its record (exit 1 on a change)
//   node tools/freeze.mjs freeze <Name…> [--date Y-M-D]   freeze (meta.ts gets `frozen`, the record its digest)
//   node tools/freeze.mjs thaw <Name…> --reason "…"       unfreeze for new work (meta.ts loses `frozen`; the reason is logged)
//   node tools/freeze.mjs refresh <Name…> --reason "…"    an approved change on a frozen component: new digest, logged
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RECORD = join(ROOT, "docs", "freeze.json");
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

/** Every file under a path (a folder, recursively, sorted), or the file itself. */
function filesOf(abs) {
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((d) => filesOf(join(abs, d.name)));
}
/** The digest of a component's tracked paths: each file's path and text (line ends made LF, so a checkout's
 * autocrlf does not count as a change). */
export function digest(paths) {
  const h = createHash("sha256");
  for (const p of paths) for (const f of filesOf(join(ROOT, p))) {
    h.update(rel(f)); h.update("\0");
    h.update(readFileSync(f, "utf8").replace(/\r\n/g, "\n")); h.update("\0");
  }
  return h.digest("hex").slice(0, 32);
}
export const readRecord = () => (existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")) : { components: {}, log: [] });
const writeRecord = (r) => {
  const sorted = Object.fromEntries(Object.entries(r.components).sort(([a], [b]) => a.localeCompare(b, "en")));
  writeFileSync(RECORD, `${JSON.stringify({ ...r, components: sorted }, null, 1)}\n`);
};

/** Every component: name, folder, meta.ts path. */
export function components() {
  const out = [];
  const base = join(ROOT, "src", "components");
  for (const cat of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const d of readdirSync(join(base, cat.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const meta = join(base, cat.name, d.name, "meta.ts");
      if (!existsSync(meta)) continue;
      const text = readFileSync(meta, "utf8");
      const name = /\bname:\s*"([^"]+)"/.exec(text)?.[1];
      if (name) out.push({ name, dir: `src/components/${cat.name}/${d.name}`, meta, frozen: /\bfrozen:\s*"([^"]+)"/.exec(text)?.[1] ?? null });
    }
  }
  return out;
}

const setMeta = (meta, date) => {
  let t = readFileSync(meta, "utf8");
  const eol = t.includes("\r\n") ? "\r\n" : "\n";
  t = t.replace(/^\s*frozen:\s*"[^"]*",?\r?\n/m, "");
  if (date) t = t.replace(/^(\s*)(status:\s*"[^"]*",?)\r?\n/m, (_, sp, line) => `${sp}${line}${eol}${sp}frozen: "${date}",${eol}`);
  writeFileSync(meta, t);
};

async function main(argv) {
  const [cmd = "status", ...rest] = argv;
  const flag = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  const names = rest.filter((x, i) => !x.startsWith("--") && !(i > 0 && rest[i - 1]?.startsWith("--")));
  const all = components(), record = readRecord();
  record.log ??= [];
  const pick = (n) => { const c = all.find((x) => x.name === n || x.dir.endsWith(`/${n}`)); if (!c) throw new Error(`no component ${n}`); return c; };
  const today = flag("--date") ?? new Date().toISOString().slice(0, 10);
  if (cmd === "status") {
    const open = all.filter((c) => !record.components[c.name]);
    console.log(`${all.length - open.length}/${all.length} frozen`);
    if (open.length) console.log(`not frozen: ${open.map((c) => c.name).join(", ")}`);
    return 0;
  }
  if (cmd === "check") {
    const bad = Object.entries(record.components).filter(([, e]) => digest(e.paths) !== e.hash).map(([n]) => n);
    console.log(bad.length ? `changed while frozen: ${bad.join(", ")}` : `ok: ${Object.keys(record.components).length} frozen components unchanged`);
    return bad.length ? 1 : 0;
  }
  if (!names.length) throw new Error(`${cmd}: name at least one component`);
  const reason = flag("--reason");
  if ((cmd === "thaw" || cmd === "refresh") && !reason) throw new Error(`${cmd} needs --reason "…" (why the freeze is lifted / the change)`);
  for (const n of names) {
    const c = pick(n);
    if (cmd === "freeze" || cmd === "refresh") {
      const was = record.components[c.name];
      if (cmd === "refresh" && !was) throw new Error(`${c.name} is not frozen`);
      const date = cmd === "refresh" ? was.frozen : today;
      setMeta(c.meta, date);
      const paths = [c.dir];
      record.components[c.name] = { frozen: date, paths, hash: digest(paths) };
      if (cmd === "refresh") record.log.push({ at: today, name: c.name, what: "refresh", reason });
      console.log(`${cmd === "refresh" ? "refreshed" : "frozen"}: ${c.name} (${paths.join(", ")})`);
    } else if (cmd === "thaw") {
      if (!record.components[c.name]) { console.log(`${c.name} is not frozen`); continue; }
      delete record.components[c.name];
      setMeta(c.meta, null);
      record.log.push({ at: today, name: c.name, what: "thaw", reason });
      console.log(`thawed: ${c.name}`);
    } else throw new Error(`unknown command ${cmd}`);
  }
  writeRecord(record);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
