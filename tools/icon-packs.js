#!/usr/bin/env node
// Icon packs for this repository: node tools/icon-packs.js add lucide tabler … | all, list, gallery <dir>.
// Same as `march icons …` (cli/icons.js), run from the repository root: packs land in src/icons/packs/<id>/.
import { fileURLToPath } from "node:url";
import { main } from "../cli/icons.js";
await main(process.argv.slice(2), { cwd: fileURLToPath(new URL("..", import.meta.url)) });
