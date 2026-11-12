// AppError: the one error shape of HADI March (net, WebSocket, boundaries, window errors). Small on purpose: net
// imports it without pulling the whole errors module; hadi-march/errors installs the sink that collects them.

export type ErrorType =
  | "network" | "offline" | "timeout" | "abort" | "http" | "auth" | "forbidden" | "notFound" | "validation"
  | "conflict" | "rateLimit" | "server" | "runtime" | "unknown";
export type Severity = "info" | "warning" | "error" | "fatal";
export type ErrorSource = "net" | "ws" | "window" | "promise" | "boundary" | "manual";

export interface AppErrorInit {
  type?: ErrorType | undefined;
  code?: string | undefined;
  status?: number | undefined;
  severity?: Severity | undefined;
  source?: ErrorSource | undefined;
  retryable?: boolean | undefined;
  cause?: unknown | undefined;
  context?: Record<string, unknown> | undefined;
}

const byStatus = (s: number): ErrorType =>
  s === 401 ? "auth" : s === 403 ? "forbidden" : s === 404 ? "notFound" : s === 409 ? "conflict" : s === 422 || s === 400 ? "validation"
    : s === 429 ? "rateLimit" : s === 408 ? "timeout" : s >= 500 ? "server" : "http";

/** An error with a type (network, auth, validation, server …), a code, the HTTP status and field errors. */
export class AppError extends Error {
  /** The kind of failure, such as network, auth, validation or server. */
  type: ErrorType;
  /** A stable machine-readable code, such as HTTP_404. */
  code: string;
  /** The HTTP status, or 0 when there was no response. */
  status: number;
  /** How serious the error is: info, warning or error. */
  severity: Severity;
  /** Which part of the app raised the error. */
  source: ErrorSource;
  /** True when trying the same request again may succeed. */
  retryable: boolean;
  /** The original error or value that caused this one. */
  override cause: unknown;
  /** Extra details about the failure, such as the URL or field errors. */
  context: Record<string, unknown>;
  constructor(message: string, init: AppErrorInit = {}) {
    super(message);
    this.name = "AppError";
    const status = init.status ?? 0;
    this.type = init.type ?? (status ? byStatus(status) : "unknown");
    this.status = status;
    this.code = init.code ?? (status ? `HTTP_${status}` : this.type.toUpperCase());
    this.severity = init.severity ?? (this.type === "abort" ? "info" : this.type === "validation" || this.type === "offline" ? "warning" : "error");
    this.source = init.source ?? "manual";
    this.retryable = init.retryable ?? (["network", "offline", "timeout", "rateLimit", "server"].includes(this.type) && status !== 501);
    this.cause = init.cause;
    this.context = init.context ?? {};
  }

  /** Normalize anything thrown into an AppError (an AppError gets `extra` merged in, never replaced). */
  static from(e: unknown, extra: AppErrorInit = {}): AppError {
    if (e instanceof AppError) {
      if (extra.context) e.context = { ...extra.context, ...e.context };
      if (extra.source && e.source === "manual") e.source = extra.source;
      return e;
    }
    const x = e as { name?: string; message?: unknown; status?: unknown; code?: unknown } | null;
    const status = Number(x?.status) || 0;
    const type: ErrorType | undefined = x?.name === "AbortError" ? "abort" : x?.name === "TimeoutError" ? "timeout"
      : e instanceof TypeError && extra.source === "net" ? "network" : status ? undefined : e instanceof Error ? "runtime" : undefined;
    const err = new AppError(String(x?.message ?? e ?? "Error"), { type, status, code: typeof x?.code === "string" ? x.code : undefined, cause: e, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)) });
    if (e instanceof Error && e.stack) err.stack = e.stack;
    return err;
  }
}

/** True for aborts (a cancelled request is not a failure). */
export const isAbort = (e: unknown): boolean => (e as { name?: string; type?: string } | null)?.name === "AbortError" || (e as AppError | null)?.type === "abort";

type Sink = (e: AppError) => void;
let sink: Sink | null = null;
/** hadi-march/errors installs the collector here; until then reported errors go nowhere. */
export function setErrorSink(fn: Sink | null): void { sink = fn; }
/** Hand an error to the collector (no-op when hadi-march/errors is not installed). */
export function emitError(e: AppError): void { sink?.(e); }
