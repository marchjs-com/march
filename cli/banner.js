// The console banner: one styled line (plus an optional tip) printed once per page.
// Dev: part of the dev client. Production: only with `credit: true` (written to credit.js, a tiny separate file), so the app bundle never contains it.
import { MARCH_URL } from "../src/brand.js";

/** @param {string} version package version ("0.1.0" → "v0.1"); @param {string} [tip] */
export function bannerSource(version, tip = "") {
  const v = version.split(".").slice(0, 2).join(".");
  const args = [`%c🧡 HADI March v${v} · ${MARCH_URL}`, "color:#f97316;font-weight:600"];
  const tipLine = tip ? `console.log(${JSON.stringify(tip)});` : "";
  // once per page: a flag on globalThis (re-mounts, repeated script runs and HMR re-evaluation never print it twice)
  return `if (!globalThis[Symbol.for("hadi-march.banner")]) { globalThis[Symbol.for("hadi-march.banner")] = true; console.log(...${JSON.stringify(args)});${tipLine} }\n`;
}
