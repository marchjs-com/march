// Manager events on channels: every emit(manager, type, detail) is published to the `managers` channel with the
// topic `<manager>:<type>` ("idle:idle", "session:warn", "window:tabs"…) and to "managers.<manager>". Nothing to
// connect: components listen without knowing the manager.
//
//   import { onManager } from "hadi-march/managers/channels";
//   onManager("session:*", (m) => …)    onManager("*", log)       // removed with the owning component
export { managerChannel, managerChannelOf, onManager } from "../manager.ts";
export type { ManagerMessage, ManagerChannelMessage } from "../manager.ts";
