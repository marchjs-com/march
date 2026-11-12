#!/usr/bin/env node
// src/ui/accent.css ← src/css/colors.css: one rule per color token that remaps the primary family on <html data-hm-accent>.
// `--check` fails when it is stale (test/colors.test.js).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const src = readFileSync(`${root}src/css/colors.css`, "utf8");
const rows = [...src.matchAll(/\[data-hm-color="([\w-]+)"\] \{ --hm-accent: (.*?); --hm-accent-text: (.*?); --hm-on-accent: (.*?); \}/g)];
const lines = ["/* HADI March — app accent (setAccent / <AccentPicker>): <html data-hm-accent=\"…\"> remaps the primary color family, so",
  "   every component without its own `color` (and color=\"primary\") follows the chosen accent: fills, focus rings, links,",
  "   active navigation, buttons; a multicolor theme default (progress, spinner) becomes the accent too (colors=\"brand\" stays).",
  "   Generated from src/css/colors.css by tools/gen-accent.js. Scoped themes keep their own. */"];
for (const [, name, fill, text, on] of rows) if (name !== "primary") lines.push(`:root[data-hm-accent="${name}"][data-hm-accent] { --hm-primary: ${fill}; --hm-primary-solid: ${fill}; --hm-primary-text: ${text}; --hm-on-primary: ${on}; --hm-on-primary-fill: ${on}; --hm-progress-fill: ${fill}; --hm-spinner-paint: none; --hm-spinner-track: color-mix(in srgb, currentColor 18%, transparent); --hm-spinner-head: ${fill}; --hm-otp-1: ${fill}; --hm-otp-2: ${fill}; --hm-otp-3: ${fill}; --hm-otp-4: ${fill}; }`);
const css = `${lines.join("\n")}\n`;
const file = `${root}src/ui/accent.css`;
if (process.argv.includes("--check")) { if (readFileSync(file, "utf8") !== css) { console.error("✖ src/ui/accent.css is stale: node tools/gen-accent.js"); process.exit(1); } console.log("✔ accent.css up to date"); }
else { writeFileSync(file, css); console.log(`✔ src/ui/accent.css (${rows.length - 1} accents)`); }
