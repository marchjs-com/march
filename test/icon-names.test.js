import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { compile } from "../compiler/index.js";
import { iconByName, isIconProp, exportName } from "../compiler/icon-names.js";

test("icon names: a pack's name, a March name, an exception; anything else is no icon", () => {
  assert.deepEqual(iconByName("lucide:heart"), { from: "march/icons/lucide", name: "heart" });
  assert.deepEqual(iconByName("chevron-down"), { from: "march/icons", name: "chevronDown" });
  assert.deepEqual(iconByName("march:package"), { from: "march/icons", name: "packageBox" }, "March's export, from its set");
  assert.deepEqual(iconByName("lucide:arrow-down-01"), { from: "march/icons/lucide", name: "arrowDown012" }, "two files share a name");
  assert.deepEqual(iconByName("material-symbols:10k"), { from: "march/icons/material-symbols", name: "i10k" });
  assert.equal(iconByName("★"), null);
  assert.equal(iconByName("Kaydet"), null, "a word that is no March icon stays text");
  assert.equal(iconByName("nopack:heart"), null);
  assert.ok(isIconProp("icon") && isIconProp("iconEnd") && isIconProp("spinner") && isIconProp("closeIcon"));
  assert.ok(!isIconProp("title") && !isIconProp("iconic"));
  assert.equal(exportName("delete"), "deleteIcon");
});

test("compiler: icon=\"pack:name\" on a component is an import of that icon; text, other props and elements stay as written", () => {
  const src = `import { Button } from "march/ui"
export const A = () => <div><Button icon="lucide:heart" iconEnd="chevron-down">Hi</Button><Button icon="lucide:heart" spinner="★" title="lucide:heart" /><i icon="heart" /></div>`;
  const out = compile(src, { filename: "a.tsx" }).code;
  assert.match(out, /import \{ heart as _mi_lucide_heart \} from "march\/icons\/lucide";/, "one import, used twice");
  assert.match(out, /import \{ chevronDown as _mi_march_chevronDown \} from "march\/icons";/);
  assert.match(out, /icon: _mi_lucide_heart, iconEnd: _mi_march_chevronDown/);
  assert.match(out, /spinner: "★"/);
  assert.match(out, /title: "lucide:heart"/);
  assert.equal(out.match(/_mi_lucide_heart \}/g).length, 1);
  assert.match(compile(src, { filename: "a.tsx", runtime: "hadi-march" }).code, /from "hadi-march\/icons\/lucide"/, "the runtime package's icons");
  assert.match(compile(src, { filename: "a.tsx", typecheck: true }).code, /icon: "lucide:heart"/, "typecheck keeps the text");
});

test("gen-icon-names --check: the compiler's icon table matches the icons", () => {
  execFileSync(process.execPath, ["tools/gen-icon-names.js", "--check"], { cwd: new URL("..", import.meta.url), stdio: "pipe" });
});

test("compiler: an object's icon key and icon(\"…\") of march/icons/packs written with a name are imports; other strings stay", () => {
  const out = compile(`import { icon } from "march/icons/packs"
const items = [{ label: "Kalp", icon: "lucide:heart" }, { "closeIcon": "x" }, { icon: name }]
let a = "lucide:icon"
const t = { title: "lucide:heart" }
const b = icon("tabler:rocket"), c = icon(dyn)`, { filename: "a.tsx" }).code;
  assert.match(out, /icon: _mi_lucide_heart/);
  assert.match(out, /"closeIcon": _mi_march_x/);
  assert.match(out, /icon: name/);
  assert.match(out, /let a = "lucide:icon"/, "a plain variable stays a text");
  assert.match(out, /title: "lucide:heart"/, "a key that is no icon key stays a text");
  assert.match(out, /const b = _mi_tabler_rocket, c = icon\(dyn\)/, "a written name is an import; a name known at run time goes through icon()");
  assert.match(out, /import \{ rocket as _mi_tabler_rocket \} from "march\/icons\/tabler"/);
  assert.match(compile(`const b = icon("tabler:rocket")`, { filename: "b.tsx" }).code, /icon\("tabler:rocket"\)/, "an icon() that is not march's stays");
});
