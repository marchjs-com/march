// The code the showcase writes from Playground options (examples/showcase/src/gen-code.ts) and reads back when it is
// edited. Every component folder whose playground.ts has `code` must round-trip: options → code → the same options.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { genCode, parseCode, lexCode, choices } from "../examples/showcase/src/gen-code.ts";

const ROOT = fileURLToPath(new URL("../src/components/", import.meta.url));
const folders = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())
  .flatMap((c) => readdirSync(join(ROOT, c.name), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(ROOT, c.name, d.name, "playground.ts"))).map((d) => `${c.name}/${d.name}`));
const nameOf = (folder) => /name: "([^"]+)"/.exec(readFileSync(join(ROOT, folder, "meta.ts"), "utf8"))[1];
const load = async (folder) => (await import(pathToFileURL(join(ROOT, folder, "playground.ts")).href)).default;
const defaults = (spec) => Object.fromEntries(spec.options.map((o) => [o.key, o.default]));

/** The folders this stage must cover (is-2-5-asamalar.md › 4.3) and the code of their default options. */
const FIRST = {
  "actions/button": `<Button icon={plus}>Yeni proje</Button>`,
  "forms/select": `<Select bind:value={$city} options={CITIES} placeholder="Seç…" />`,
  "forms/toggle": `<Toggle bind:value={$notify} label="Anlık bildirimler" />`,
  "forms/text-input": `<TextInput bind:value={$text} prefix={<Icon of={search} />} />`,
  "feedback/alert": `<Alert title="Bakım penceresi"\n  action={<Button size="sm">Yeniden dene</Button>} dismissable>\n  Pazar 03:00–03:30 arası ödeme sağlayıcısı bakımda.\n</Alert>`,
  "data/badge": `<Badge tone="success">Etkin</Badge>`,
  "navigation/tabs": `<Tabs bind:value={$tab} label="Proje" tabs={tabs} />`,
  "social/avatar": `<Avatar name="Elif Arslan" src={photo} />`,
  // the post and the ⋯ menu are JSON literals (MarchIDE gives the same values to the raw PostCard)
  "composite/post-card": /^<PostCard onLike=\{like\}\n  post=\{\{"id":"p1",.*"media":\[(\{"src":"data:image\/png;base64,[^"]+","alt":"Fotoğraf \d"\},?){3}\].*\}\}\n  menu=\{\[\{"label":"Bağlantıyı kopyala"\},.*\]\} \/>$/,
};

test("the first folders write the expected code for their default options", async () => {
  for (const [folder, code] of Object.entries(FIRST)) {
    const spec = await load(folder);
    const got = genCode(spec, nameOf(folder), defaults(spec));
    if (code instanceof RegExp) assert.match(got, code, folder); else assert.equal(got, code, folder);
  }
});

test("every playground with `code` round-trips: options → code → the same options", async () => {
  let checked = 0;
  for (const folder of folders) {
    const spec = await load(folder);
    if (!spec.code || typeof spec.code !== "object") continue;
    const name = nameOf(folder), base = defaults(spec);
    const back = parseCode(spec, name, genCode(spec, name, base), base);
    assert.deepEqual(back.errors, [], `${folder}: default code has errors`);
    assert.deepEqual(back.values, base, `${folder}: default code changes the options`);
    for (const o of spec.options) {
      if (o.prop === false && !o.fromCode) continue;
      const list = choices(o) ?? (typeof o.default === "number" ? [o.min ?? 0, o.max ?? 1] : ["Başka bir yazı"]);
      for (const value of list) {
        const values = { ...base, [o.key]: value };
        if (o.visibleWhen && !o.visibleWhen(values)) continue;
        const code = genCode(spec, name, values);
        const got = parseCode(spec, name, code, base);
        assert.deepEqual(got.errors, [], `${folder} › ${o.key}=${String(value)}: ${code}`);
        // an option of the demo (prop: false) is read back only when the code shows it
        if (o.prop !== false) assert.equal(got.values[o.key], value, `${folder} › ${o.key}=${String(value)}: ${code}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 40, `only ${checked} option values were checked`);
});

test("edited code: valid parts apply, the rest is said in words", async () => {
  const spec = await load("actions/button"), base = defaults(spec);
  const ok = parseCode(spec, "Button", `<Button variant="ghost" size="lg" loading title="Kaydet" m:no-select data-x="1">Kaydet</Button>`, base);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.variant, "ghost"); assert.equal(ok.values.size, "lg"); assert.equal(ok.values.loading, true);
  assert.equal(ok.values.icon, false, "icon is not written: no icon");
  assert.equal(ok.values.label, "Kaydet");
  assert.deepEqual(ok.extras, [{ name: "title", value: '"Kaydet"' }, { name: "m:no-select", value: "" }, { name: "data-x", value: '"1"' }]);
  assert.deepEqual(ok.changed.sort(), ["icon", "label", "loading", "size", "variant"]);

  const bad = parseCode(spec, "Button", `<Button variant="outline" size="lg" nope>Yeni proje</Button>`, base);
  assert.equal(bad.values.size, "lg", "the valid part still applies");
  assert.equal(bad.values.variant, "primary");
  assert.match(bad.errors[0], /variant: "outline" burada yok → "secondary"/);
  assert.match(bad.errors[1], /nope: Button özelliği ya da HTML özniteliği değil/);

  const open = parseCode(spec, "Button", `<Button variant="gho`, base);
  assert.ok(open.errors.some((e) => e.includes("etiket kapanmadı")));
  const known = parseCode(spec, "Button", `<Button href="/docs" icon={plus}>Yeni proje</Button>`, base, ["href"]);
  assert.match(known.errors[0], /href: Button özelliği; bu sahne onu uygulamıyor/);
});

test("the lexer keeps places and nested braces", () => {
  const lex = lexCode(`<PostCard post={post} parts={{ avatar: { size: "lg" } }} m:no-select />`);
  assert.equal(lex.tag, "PostCard");
  assert.deepEqual(lex.attrs.map((a) => [a.name, a.value]), [["post", "{post}"], ["parts", `{{ avatar: { size: "lg" } }}`], ["m:no-select", ""]]);
  assert.equal(lex.closed, true);
  assert.equal(lexCode(`<Button>Tamam</Button>`).children, "Tamam");
});

test("m:parts: a part's own playground gives the options that work from outside; the attribute round-trips", async () => {
  const { partOptions, partsAttr, parseParts } = await import("../examples/showcase/src/gen-code.ts");
  const avatar = partOptions(await load("social/avatar")), like = partOptions(await load("social/like-button"));
  assert.deepEqual(avatar.map((o) => o.prop), ["size", "shape", "color"], "content (text / icon) and src write code: left out");
  assert.equal(avatar[2].value("name"), undefined, "the value that writes nothing sets nothing");
  assert.equal(avatar[2].value("brand-orange"), "brand-orange");
  assert.ok(like.some((o) => o.prop === "pop") && !like.some((o) => o.prop === "icon" || o.prop === "burstOptions"));
  assert.equal(like.find((o) => o.prop === "pop").value(false), false);
  assert.deepEqual(partOptions(await load("data/card")), [], "a playground without `code`: its keys may be the demo's, nothing is offered");

  const known = { Avatar: avatar, LikeButton: like };
  const code = partsAttr({ Avatar: { size: "lg", shape: "square" }, LikeButton: { pop: false }, CountRoll: {} });
  assert.equal(code, `{{ Avatar: { size: "lg", shape: "square" }, LikeButton: { pop: false } }}`);
  assert.equal(partsAttr({ Avatar: {} }), null);
  assert.deepEqual(parseParts(code, known), { values: { Avatar: { size: "lg", shape: "square" }, LikeButton: { pop: false } }, errors: [] });
  const bad = parseParts(`{{ Avatar: { size: "huge", shape: "square", nope: 1 }, Card: { flat: true } }}`, known);
  assert.deepEqual(bad.values, { Avatar: { shape: "square" } }, "the valid part applies");
  assert.match(bad.errors[0], /m:parts\.Avatar\.size: "huge" burada yok → "xs", "sm"/);
  assert.match(bad.errors[1], /m:parts\.Avatar\.nope: buradan ayarlanmıyor → size, shape, color/);
  assert.match(bad.errors[2], /m:parts\.Card: bu bileşende böyle bir parça yok → Avatar, LikeButton/);
  assert.ok(parseParts(`{ Avatar }`, known).errors.length);
});
