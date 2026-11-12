// Manager events on a channel: every emit(manager, type, detail) is published to the `managers` channel with the topic
// `<manager>:<type>` ("idle:idle", "session:warn", "window:tabs"…). Components listen without knowing the manager.
//
//   import { connectManagerChannels, onManager } from "hadi-march/managers/channels";
//   connectManagerChannels();                                    // once, at start-up
//   onManager("session:*", (m) => …)    onManager("*", log)       // removed with the owning component
import { channel, type Channel } from "../../channel/index.ts";
import { setManagerEmit, type ManagerEvent, type ManagerEmit } from "../manager.ts";

/** A manager event as it travels on the channel. */
export interface ManagerMessage extends ManagerEvent { topic: string; at: number }

/** The `managers` channel (keeps the last 50 messages for late listeners and devtools). */
export const managerChannel: Channel<ManagerMessage> = channel<ManagerMessage>("managers", { replay: 50 });

let connected: ManagerEmit | null = null;

/** Publish every manager event to the `managers` channel (the previous sink keeps receiving them). Idempotent. */
export function connectManagerChannels(): () => void {
  if (connected) return disconnectManagerChannels;
  let prev: ManagerEmit | null = null;
  connected = (e) => {
    managerChannel.emit({ ...e, topic: `${e.manager}:${e.type}`, at: Date.now() });
    prev?.(e);
  };
  prev = setManagerEmit(connected);
  const mine = connected;
  disconnect = () => { if (connected === mine) { setManagerEmit(prev); connected = null; } };
  return disconnectManagerChannels;
}
let disconnect = (): void => {};
/** Stop publishing (the previous sink is restored). */
export function disconnectManagerChannels(): void { disconnect(); }

const matches = (pattern: string, topic: string): boolean =>
  pattern === "*" || (pattern.endsWith("*") ? topic.startsWith(pattern.slice(0, -1)) : topic === pattern);

/** Listen to manager events by topic: "idle:idle", "session:*", "*". Replayed messages are skipped unless replay is true. */
export function onManager(pattern: string, fn: (m: ManagerMessage) => void, opts: { replay?: boolean } = {}): () => void {
  return managerChannel.on((m) => { if (matches(pattern, m.topic)) fn(m); }, { replay: opts.replay ?? false });
}
