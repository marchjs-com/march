// Small file-system helpers shared by the compiler, the CLI and the tools (one copy each).
import { sep } from "node:path";

/** A path with forward slashes (Windows separators turned into "/"): stable keys, import specifiers, report names. */
export const posix = (p) => p.split(sep).join("/");
