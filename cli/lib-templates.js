// `march gen component <name>` inside the march repository: one folder with every file the checklist asks for.
/** @returns {Record<string, string>} file name → content */
export function libComponent(folder, Name, category = "layout", composedOf = []) {
  const cls = `m-${folder}`;
  return {
    "index.ts": `// ${Name} (march/ui). Draws only: state comes from shared engines and behaviors.
import "./${folder}.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";

export interface ${Name}Props {
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  class?: ClassProp;
  children?: unknown;
}

/** \`<${Name}>…</${Name}>\` */
export function ${Name}(props: ${Name}Props): Element {
  return h("div", { class: () => cx("${cls}", \`${cls}-\${val(props.size) ?? "md"}\`, val(props.class)) }, props.children);
}
`,
    [`${folder}.css`]: `/* ${Name}. Theme tokens only, logical properties, durations from --m-dur tokens, no @keyframes (motion core). */
.${cls} { display: block; padding: var(--m-space-3); border-radius: var(--m-radius-3); }
.${cls}-sm { padding: var(--m-space-2); }
.${cls}-lg { padding: var(--m-space-4); }
`,
    [`${folder}.test.js`]: `import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ${Name} } = await import("./index.ts");

test("${Name} renders its children with the size class", () => {
  const el = document.createElement("div");
  const dispose = render(() => h(${Name}, { size: "sm" }, "x"), el);
  assert.ok(el.querySelector(".${cls}.${cls}-sm"));
  dispose();
});
`,
    "docs.md": `# ${Name}

One sentence: what it is for.

\`\`\`tsx
<${Name} size="sm">…</${Name}>
\`\`\`

## Props

| Prop | Type | Default | |
|---|---|---|---|
| \`size\` | \`sm\` \`md\` \`lg\` | \`md\` | |

## Accessibility

Roles, keyboard, announcements.

## Composed of

${composedOf.length ? composedOf.join(", ") : "—"}
`,
    "demo.tsx": `// Showcase stage for ${Name}: draws it for the Playground values (playground.ts).
import { ${Name} } from "./index.ts";

export const code = \`<${Name} size="sm">…</${Name}>\`

export default function ${Name}Demo(props: { values: { size: string } }) {
  return <div>{() => <${Name} size={props.values.size as "md"}>${Name}</${Name}>}</div>
}
`,
    "playground.ts": `import { definePlayground } from "../../meta.ts";

export default definePlayground<{ size: string }>({
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
  ],
});
`,
    "meta.ts": `import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "${Name}",
  status: "experimental",
  since: "0.1.0",
  summary: "One line for catalogues.",
  category: "${category}",
  composedOf: ${JSON.stringify(composedOf)},
  behaviors: [],
  hubs: ["d"],
});
`,
  };
}
