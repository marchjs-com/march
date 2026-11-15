// Scaffolding templates for `march gen`.
const pascal = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Page";

export const templates = {
  indexHtml: () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MarchJS app</title>
  <!--march-->
</head>
<body>
  <div id="m-boot" class="m-boot" role="status" aria-label="Loading"><span class="m-loading"></span></div>
  <div id="app"></div>
</body>
</html>
`,
  page: (name) => {
    const params = [...name.matchAll(/\[(?:\.\.\.)?(\w+)\]/g)].map((m) => m[1]);
    const C = pascal(name.replace(/\[|\]|\.\.\./g, ""));
    return `// Page: ${name}
export const title = "${C}";

export default function ${C}Page(props) {
${params.map((p) => `  const ${p} = () => props.params.${p};`).join("\n")}
  return <Page title="${C}">
    <p>${params.length ? params.map((p) => `${p}: {${p}()}`).join(" ") : "New page"}</p>
  </Page>;
}
`;
  },
  component: (name) => `export default function ${pascal(name)}(props) {
  return <div class="${name.replace(/[A-Z]/g, (m, i) => (i ? "-" : "") + m.toLowerCase())}">{props.children}</div>;
}
`,
  crud: (name) => {
    const C = pascal(name);
    return `// CRUD page for "${name}". Replace the source with your API.
const ${C} = schema({
  name: { type: "text", required: true, max: 80 },
  status: { type: "pick", options: ["draft", "live"], default: "draft" },
  updatedAt: { type: "datetime", readonly: true },
});

const source = {
  list: (params) => fetchJson(\`/api/${name}?\${new URLSearchParams({ page: params.page, size: params.size, q: params.search ?? "" })}\`),
  create: (v) => fetchJson("/api/${name}", { method: "POST", body: v }),
  update: (id, v) => fetchJson(\`/api/${name}/\${id}\`, { method: "PATCH", body: v }),
  remove: (id) => fetchJson(\`/api/${name}/\${id}\`, { method: "DELETE" }),
};

export default function ${C}Page() {
  return <Page title="${C}">{crud(source, { schema: ${C}, title: "${C}" })}</Page>;
}
`;
  },
};
