#!/usr/bin/env node
// src/ui/accent.css ← src/css/colors.css: one rule per color token that remaps the primary family on <html data-m-accent>.
// `--check` fails when it is stale (test/colors.test.js).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const src = readFileSync(`${root}src/css/colors.css`, "utf8");
const rows = [...src.matchAll(/\[data-m-color="([\w-]+)"\] \{ --m-accent: (.*?); --m-accent-text: (.*?); --m-on-accent: (.*?); \}/g)];
const lines = ["/* March — app accent (setAccent / <AccentPicker>): <html data-m-accent=\"…\"> (or any element's, for its subtree) remaps the primary color family, so",
  "   every component without its own `color` (and color=\"primary\") follows the chosen accent: fills, focus rings, links,",
  "   active navigation, buttons; a multicolor theme default (progress, spinner) becomes the accent too (colors=\"brand\" stays).",
  "   Generated from src/css/colors.css by tools/gen-accent.js. Scoped themes keep their own. */"];
for (const [, name, fill, text, on] of rows) if (name !== "primary") lines.push(`:root[data-m-accent="${name}"][data-m-accent], [data-m-accent="${name}"] { --m-primary: ${fill}; --m-primary-solid: ${fill}; --m-primary-text: ${text}; --m-on-primary: ${on}; --m-on-primary-fill: ${on}; --m-progress-fill: ${fill}; --m-spinner-paint: none; --m-spinner-track: color-mix(in srgb, currentColor 18%, transparent); --m-spinner-head: ${fill}; --m-otp-1: ${fill}; --m-otp-2: ${fill}; --m-otp-3: ${fill}; --m-otp-4: ${fill}; }`);
const css = `${lines.join("\n")}\n`;
const file = `${root}src/ui/accent.css`;
if (process.argv.includes("--check")) { if (readFileSync(file, "utf8") !== css) { console.error("✖ src/ui/accent.css is stale: node tools/gen-accent.js"); process.exit(1); } console.log("✔ accent.css up to date"); }
else { writeFileSync(file, css); console.log(`✔ src/ui/accent.css (${rows.length - 1} accents)`); }
