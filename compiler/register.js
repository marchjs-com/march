// `node --import march/register …` — lets node import March .jsx files (compiled on the fly).
import { register } from "node:module";
// node 22 cannot chain an in-thread sync hook (load-ts.js) into these hooks-thread ones; node-loader.js stubs .css itself
globalThis[Symbol.for("march.asyncHooks")] = true;
register("./node-loader.js", import.meta.url);
