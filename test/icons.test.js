import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, h, render } = await import("../src/index.ts");
const { reactive } = await import("../src/core/reactive.ts");
const I = await import("../src/icons/index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("<Icon> follows live props: size, icon and label repaint the same <svg>", () => {
  const size = signal("md"), of = signal(I.users), label = signal(undefined);
  // the compiler passes live props as reactive thunks (size={$size} → reactive(() => $size()))
  const el = mount(() => h(I.Icon, { of: reactive(() => of()), size: reactive(() => size()), label: reactive(() => label()) }));
  const svg = el.querySelector("svg");
  assert.match(svg.getAttribute("class"), /hm-svg-md/);
  size.set("xl");
  assert.equal(el.querySelector("svg"), svg, "same element");
  assert.match(svg.getAttribute("class"), /hm-svg-xl/);
  assert.doesNotMatch(svg.getAttribute("class"), /hm-svg-md/);
  of.set(I.search);
  assert.equal(svg.getAttribute("data-icon"), "search");
  assert.equal(svg.getAttribute("aria-hidden"), "true");
  label.set("Search");
  assert.equal(svg.getAttribute("role"), "img");
  assert.equal(svg.getAttribute("aria-label"), "Search");
  assert.equal(svg.getAttribute("aria-hidden"), null);
});

test("deep imports rewrite the import header only, never an import written inside a string", async () => {
  const { deepImports } = await import("../compiler/deep-imports.js");
  const barrels = { "hadi-march/icons": resolve("src/icons/index.ts") };
  const src = 'import { For } from "hadi-march";// page\nimport { Icon, users } from "hadi-march/icons";\nimport {\n  a\n} from "./x";\n'
    + 'const code = `import { Icon, users } from "hadi-march/icons"`;\n';
  const out = deepImports(src, barrels);
  assert.match(out, /^import \{ For \} from "hadi-march";/);
  assert.match(out, /import \{ users \} from "[^"]*src\/icons\/glyphs\/users\.ts";/);
  assert.ok(out.endsWith('const code = `import { Icon, users } from "hadi-march/icons"`;\n'), "the code sample is untouched");
});
