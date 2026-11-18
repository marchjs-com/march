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
