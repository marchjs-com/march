// import "hadi-march/motion/install": enables the extra `transition:` names and `<For animate>` FLIP (side effect).
import { installTransitions } from "./transitions.ts";
import { installFlip } from "./flip.ts";

installTransitions();
installFlip();
