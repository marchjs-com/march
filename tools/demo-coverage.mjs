#!/usr/bin/env node
// Every exported component has a live demo card and a Playground in the showcase. A card is one `<Demo …>…</Demo>`
// block of a showcase source (examples/showcase/src/**/*.tsx). The components a card shows are the JSX tags inside it,
// plus the tags of the local components it renders (`<FooDemo />`, `view={FooDemo}`, one level, same file). A card has
// a Playground when it renders <Playground>, <LitePlayground> or <ComponentDemo> (a component folder's demo.tsx and
// playground.ts). Component folders (src/components/<category>/<name>/) count through their demo.tsx + playground.ts, and
// an API reference example (api-examples/<group>.tsx, tools/api-examples.js) is a card too: its `run` is a live demo and
// its `play` a Playground.
//   node tools/demo-coverage.mjs           list components without a demo card / without a Playground
//   node tools/demo-coverage.mjs --check   exit 1 when one is missing
// test/demo-coverage.test.js runs the check.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { packageApis } from "./api-coverage.js";
import { exampleFiles } from "./api-examples.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SHOWCASE = "examples/showcase/src";
const PLAY = /<(Playground|LitePlayground|ComponentDemo)\b/;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

/** The `<Tag` names used in a piece of source. */
const tags = (src) => new Set([...src.matchAll(/<([A-Z][\w$]*)(?:\.[A-Z][\w$]*)?[\s/>]/g)].map((m) => m[1]));

/** Bodies of the file's top-level components (`function Foo(` / `const Foo = (`), up to the next top-level declaration. */
function localComponents(src) {
  const out = new Map();
  const decl = [...src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\s+([A-Z][\w$]*)|const\s+([A-Z][\w$]*)\s*=)/gm)];
  decl.forEach((m, i) => out.set(m[1] ?? m[2], src.slice(m.index, decl[i + 1]?.index ?? src.length)));
  return out;
}

/** `<Demo …>…</Demo>` blocks of a source (nesting-aware). */
function demoBlocks(src) {
  const out = [];
  const re = /<Demo\b|<\/Demo>/g;
  let depth = 0, start = -1;
  for (const m of src.matchAll(re)) {
    if (m[0] === "<Demo") { if (depth++ === 0) start = m.index; }
    else if (depth > 0 && --depth === 0) out.push(src.slice(start, m.index));
  }
  // a self-closing <Demo … /> has no children: nothing to show
  return out;
}

/** Showcase cards: { file, title, shows: Set<component>, play: boolean }. */
export function showcaseCards(root = ROOT) {
  const cards = [];
  for (const f of walk(join(root, SHOWCASE)).filter((p) => p.endsWith(".tsx"))) {
    const src = readFileSync(f, "utf8");
    const locals = localComponents(src);
    for (const block of demoBlocks(src)) {
      const shows = new Set();
      let play = PLAY.test(block);
      const direct = new Set([...tags(block), ...[...block.matchAll(/view=\{([A-Z][\w$]*)\}/g)].map((m) => m[1])]);
      for (const t of direct) {
        shows.add(t);
        const body = locals.get(t);
        if (!body || t === "Demo") continue;
        for (const u of tags(body)) shows.add(u);
        if (PLAY.test(body)) play = true;
      }
      const folders = [...block.matchAll(/<ComponentDemo\b[^>]*folder="([^"]+)"/g)].map((m) => m[1]);
      cards.push({ file: relative(root, f).replace(/\\/g, "/"), title: /title="([^"]*)"/.exec(block)?.[1] ?? "", shows, play, folders });
    }
  }
  return cards;
}

/** Component folders: name → { demo, playground } (demo.tsx and playground.ts exist). */
function folders(root) {
  const out = new Map();
  const base = join(root, "src/components");
  for (const cat of readdirSync(base)) {
    const dir = join(base, cat);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      const meta = join(dir, name, "meta.ts");
      if (!existsSync(meta)) continue;
      const n = /name:\s*"([^"]+)"/.exec(readFileSync(meta, "utf8"))?.[1];
      if (n) out.set(n, { demo: existsSync(join(dir, name, "demo.tsx")), playground: existsSync(join(dir, name, "playground.ts")) });
    }
  }
  return out;
}

/** Every exported component with its cards; `noDemo` / `noPlay` list the gaps. */
export function coverage(root = ROOT) {
  const comps = new Map();
  for (const a of packageApis(root)) for (const i of a.items) if (i.kind === "component" && !comps.has(i.name)) comps.set(i.name, a.subpath);
  const cards = showcaseCards(root);
  const dirs = folders(root);
  const ex = new Map();
  for (const { subs, plays } of exampleFiles(root).values()) for (const [sub, names] of Object.entries(subs)) for (const n of names) ex.set(`${sub}#${n}`, plays.has(`${sub}#${n}`));
  const rows = [...comps].map(([name, subpath]) => {
    const mine = cards.filter((c) => c.shows.has(name));
    const dir = dirs.get(name);
    const example = ex.get(`${subpath}#${name}`);
    return { name, subpath, cards: [...mine.map((c) => `${c.file} › ${c.title}`), ...(example !== undefined ? [`API başvurusu › ${name}`] : [])],
      demo: mine.length > 0 || !!dir?.demo || example !== undefined, play: mine.some((c) => c.play) || !!(dir?.demo && dir.playground) || example === true };
  });
  return { rows, noDemo: rows.filter((r) => !r.demo).map((r) => `${r.subpath} › ${r.name}`), noPlay: rows.filter((r) => r.demo && !r.play).map((r) => `${r.subpath} › ${r.name}`) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { rows, noDemo, noPlay } = coverage();
  for (const m of noDemo) console.error(`✖ no showcase demo card: ${m}`);
  for (const m of noPlay) console.error(`✖ no Playground: ${m}`);
  console.log(`${rows.length} components, ${noDemo.length} without a demo card, ${noPlay.length} without a Playground`);
  if (process.argv.includes("--check") && (noDemo.length || noPlay.length)) process.exit(1);
}
