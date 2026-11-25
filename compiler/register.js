// `node --import march/register …` — lets node import March .jsx files (compiled on the fly).
import "./hooks-flag.js";
import { register } from "node:module";
register("./node-loader.js", import.meta.url);
