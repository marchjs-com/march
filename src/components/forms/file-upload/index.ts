// FileUpload: drag & drop or click, accept / maxSize checks, image and audio previews (object URLs revoked on cleanup),
// progress and cancel when an `upload(file, { onProgress, signal })` function is given.
import "./file-upload.css";
import "../../../ui/button.css";
import { signal, untrack, onCleanup, type Accessor, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { model, ctl, cx, uid, type ControlProps } from "../../../forms/util.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { Progress } from "../../../ui/progress.ts";
import { clamp } from "../../../core/util.ts";

import { dropzone, accepts } from "../../../behaviors/dropzone/index.ts";
// the accept check lives with the dropzone behavior; forms keeps exporting it
export { accepts };

const bytes = (n: number) => applyPipe("bytes", n);

/** Progress reported by an upload function: a fraction 0…1 or { loaded, total }. */
export type UploadProgress = number | { loaded: number; total: number };
/** Uploads one file; resolves with what becomes the value (a URL, an id …). */
export type UploadFn<R = unknown> = (file: File, ctx: { onProgress: (p: UploadProgress) => void; signal: AbortSignal }) => Promise<R> | R;

export interface FileUploadProps<R = unknown> extends ControlProps<unknown> {
  /** "image/*,.pdf" */
  accept?: string | undefined;
  multiple?: boolean | undefined;
  /** Bytes. */
  maxSize?: number | undefined;
  maxFiles?: number | undefined;
  upload?: UploadFn<R> | undefined;
  /** Drop zone text. */
  label?: unknown;
  onError?: ((message: string, file: File) => void) | undefined;
}

type Status = "ready" | "uploading" | "done" | "error";
interface Item { id: string; file: File; url: string | null; status: Signal<Status>; progress: Signal<number>; error: Signal<string | null>; result: unknown; ctrl: AbortController | null }

/**
 * Props: accept, multiple, maxSize (bytes), maxFiles, upload(file, { onProgress(fraction|{loaded,total}), signal }) → Promise<result>,
 * label (drop zone text). Value: without `upload` the File (or File[] with multiple); with `upload` the result(s).
 * onError(message, file) is called for rejected files.
 */
export function FileUpload<R = unknown>(props: FileUploadProps<R>): unknown {
  const multi = !!props.multiple;
  const [get, set] = model<unknown>(props, multi ? [] : null);
  const items = signal<Item[]>([], { equals: false });
  const errors = signal<string[]>([]);
  const over = signal(false);
  const urls = new Set<string>();
  const inputId = uid("hm-file");
  const c = ctl(props);
  onCleanup(() => { for (const u of urls) globalThis.URL?.revokeObjectURL?.(u); urls.clear(); for (const it of untrack(items)) it.ctrl?.abort(); });
  const revoke = (it: Item) => { if (it.url) { globalThis.URL?.revokeObjectURL?.(it.url); urls.delete(it.url); } };
  const preview = (file: File) => {
    if (!/^(image|audio)\//.test(file.type ?? "") || !globalThis.URL?.createObjectURL) return null;
    try { const u = URL.createObjectURL(file); urls.add(u); return u; } catch { return null; }
  };
  const emit = () => {
    const list = untrack(items);
    const vals = props.upload ? list.filter((x) => x.status() === "done").map((x) => x.result) : list.map((x) => x.file);
    set(multi ? vals : vals[vals.length - 1] ?? null);
  };
  const start = (it: Item) => {
    const ctrl = new AbortController();
    it.ctrl = ctrl;
    it.status.set("uploading");
    Promise.resolve().then(() => props.upload!(it.file, {
      signal: ctrl.signal,
      onProgress: (p) => { const f = typeof p === "number" ? p : p && p.total ? p.loaded / p.total : 0; it.progress.set(clamp(f, 0, 1)); },
    })).then((res) => {
      if (ctrl.signal.aborted) return;
      it.result = res; it.progress.set(1); it.status.set("done"); emit();
    }, (err: unknown) => {
      if (ctrl.signal.aborted) return;
      it.status.set("error"); it.error.set((err as Error | null)?.message ?? String(err));
    });
  };
  const add = (files: File[]) => {
    const errs: string[] = [];
    let list = multi ? [...untrack(items)] : [];
    for (const file of files) {
      let msg: string | null = null;
      if (!accepts(file, props.accept)) msg = t`${file.name}: this file type is not allowed`;
      else if (props.maxSize != null && file.size > props.maxSize) msg = t`${file.name} is too large (max ${bytes(props.maxSize)})`;
      else if (multi && props.maxFiles != null && list.length >= props.maxFiles) msg = t`At most ${props.maxFiles} files`;
      if (msg) { errs.push(msg); props.onError?.(msg, file); continue; }
      const it: Item = { id: uid("f"), file, url: preview(file), status: signal<Status>("ready"), progress: signal(0), error: signal<string | null>(null), result: undefined, ctrl: null };
      if (!multi) for (const old of list) { old.ctrl?.abort(); revoke(old); }
      list = multi ? [...list, it] : [it];
      if (!multi) break;
    }
    errors.set(errs);
    items.set(list);
    for (const it of list) if (props.upload && untrack(it.status) === "ready") start(it);
    emit();
  };
  const remove = (it: Item) => { it.ctrl?.abort(); revoke(it); items.set(untrack(items).filter((x) => x !== it)); emit(); };
  let input: HTMLInputElement;
  input = h("input", {
    type: "file", id: inputId, class: "hm-sr-only", tabindex: "-1", accept: () => props.accept ?? null, multiple: multi,
    disabled: () => !!(props.disabled || props.readonly), "aria-hidden": "true",
    onChange: (e: Event) => { const el = e.target as HTMLInputElement; add([...(el.files ?? [])]); el.value = ""; },
  }) as HTMLInputElement;
  const open = () => { if (!props.disabled && !props.readonly) input.click(); };
  const zone = h("div", {
    ...c, role: "button", tabindex: () => (props.disabled ? "-1" : "0"), class: "hm-drop", "class:hm-drop-over": over, "aria-disabled": () => (props.disabled ? "true" : null),
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
    // drops (counted enter / leave, files only) and pasted files: the dropzone behavior; add() checks accept and size
    ref: (x: HTMLElement) => dropzone(x, { onFiles: add, onOver: (on) => over.set(on), paste: true, disabled: () => !!(props.disabled || props.readonly) }),
  }, h("span", { class: "hm-drop-text" }, () => props.label ?? (multi ? t`Drop files here or click to choose` : t`Drop a file here or click to choose`)),
    () => (props.accept || props.maxSize ? h("small", { class: "hm-hint" }, [props.accept, props.maxSize != null ? t`max ${bytes(props.maxSize)}` : null].filter(Boolean).join(" · ")) : null));
  const row = (itAcc: Accessor<Item>) => {
    const it = itAcc();
    const pct = () => Math.round(it.progress() * 100);
    return h("li", { class: "hm-file", "class:hm-file-error": () => it.status() === "error" },
      it.url && it.file.type.startsWith("image/") ? h("img", { class: "hm-file-thumb", src: it.url, alt: "" }) : null,
      it.url && it.file.type.startsWith("audio/") ? h("audio", { class: "hm-file-audio", src: it.url, controls: true }) : null,
      h(OverflowText, { class: "hm-file-name" }, it.file.name), h("small", { class: "hm-hint" }, bytes(it.file.size)),
      () => (it.status() === "uploading" ? h(Progress, { class: "hm-file-progress", value: pct, max: 100, size: "sm", label: t`Uploading ${it.file.name}`, showValue: true }) : null),
      () => (it.status() === "error" ? h("span", { class: "hm-field-error", role: "alert" }, it.error()) : null),
      () => (it.status() === "done" ? h("span", { class: "hm-file-ok" }, t`Uploaded`) : null),
      props.readonly ? null : h("button", { type: "button", class: "hm-icon-btn", "aria-label": () => (it.status() === "uploading" ? t`Cancel upload of ${it.file.name}` : t`Remove ${it.file.name}`), onClick: () => remove(it) },
        () => (it.status() === "uploading" ? t`Cancel` : "×")));
  };
  const existing = () => {
    const v = get();
    if (untrack(items).length || v == null || (Array.isArray(v) && !v.length)) return null;
    const list: unknown[] = Array.isArray(v) ? v : [v];
    return h("ul", { class: "hm-files" }, list.map((x) => h("li", { class: "hm-file" },
      h(OverflowText, { class: "hm-file-name" }, typeof x === "string" ? x : (x as { name?: string } | null)?.name ?? (x as { url?: string } | null)?.url ?? String(x)),
      props.readonly ? null : h("button", { type: "button", class: "hm-icon-btn", "aria-label": t`Remove`, onClick: () => set(multi ? (untrack(get) as unknown[]).filter((y) => y !== x) : null) }, "×"))));
  };
  return h("div", { class: cx("hm-upload", props.class) }, input, zone,
    () => (errors().length ? h("ul", { class: "hm-upload-errors", role: "alert" }, errors().map((m) => h("li", { class: "hm-field-error" }, m))) : null),
    existing,
    h("ul", { class: "hm-files" }, h(For, { each: items, key: "id", children: row })));
}
