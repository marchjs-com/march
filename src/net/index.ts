// march/net: one place for all traffic. Never call fetch() / new WebSocket() in app code — use net or an Api class.
//
//   import { net, Api, api, auth, cache } from "march/net";
//   net.use(auth({ token: () => session.token, refresh: renew }), cache());
//   const users = await net.get<User[]>("/api/users", { category: "users", cache: "5m" });
//   net.get("/api/search", { query: { q }, category: "search", policy: "latest" });   // older search aborted
//   net.pending("users")   // reactive count;   net.on("net:error", …)
// Importing this module routes the router's page loads and lazy() parts through net (priority, retry, events).
import { Net } from "./core.ts";
import { HttpTransport, SseTransport } from "./transport.ts";
import { WsTransport } from "./ws.ts";
import { setDefaultNet } from "./api.ts";
import { setLoadRunner } from "../dom/preload.ts";

/** Create a Net with the standard transports (http, ws, sse). */
export function createNet(config?: ConstructorParameters<typeof Net>[0]): Net {
  return new Net(config).transport(new HttpTransport()).transport(new WsTransport()).transport(new SseTransport());
}

/** The app's Net instance. */
export const net: Net = createNet();
setDefaultNet(() => net);

/** Route page loads and lazy() chunk loads through a Net (done for the default one on import; `null` = direct). */
export function routeLoads(n: Net | null = net): void {
  setLoadRunner(n ? (fn, info) => n.request({
    run: fn, key: `load:${info.kind}:${info.key || String(Math.random())}`, category: info.kind === "route" ? "route" : "part",
    priority: info.kind === "route" ? "route" : "data", policy: "parallel", retry: 2, idempotent: true, meta: { load: info.key },
  }) : null);
}
routeLoads();

export { Net, compose, named, duration, buildUrl, sleep, onInvalidate } from "./core.ts";
export type { RequestOptions, NetRequest, NetResponse, Ctx, Middleware, Transport, Policy, Priority, Method, RetryOptions, Step, NetEvent, NetEventName, NetConfig } from "./core.ts";
export { HttpTransport, SseTransport, resolveUrl, parseBody, headersOf } from "./transport.ts";
export { WsTransport, ManagedSocket, socket, closeSockets, setSocketFactory, backoff, jsonProtocol } from "./ws.ts";
export type { SocketState, SocketLike, SocketFactory, SocketProtocol, SocketOptions } from "./ws.ts";
export { auth, acceptLanguage, idempotencyKey, retry, cache, timing, log, record, replay, normalizeErrors } from "./middleware.ts";
export type { Recording } from "./middleware.ts";
export { Api, api } from "./api.ts";
export type { Endpoint, EndpointArgs, EndpointOptions, CallOptions, Stream, Validator } from "./api.ts";
export { AppError, isAbort } from "../errors/app-error.ts";
