// FileUpload: drag & drop or click, accept / maxSize checks, image and audio previews (object URLs revoked on cleanup),
// progress and cancel when an `upload(file, { onProgress, signal })` function is given.
import "./file-upload.css";
import { signal, untrack, onCleanup, type Accessor, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { model, ctl, cx, uid, type ControlProps } from "../../../forms/util.ts";
import { Progress } from "../../../ui/progress.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { locked, isActivateKey } from "../../../ui/behave.ts";
import { ownPart } from "../../../ui/parts.ts";
import { errorText } from "../../../ui/format.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";

import { dropzone, accepts } from "../../../behaviors/dropzone/index.ts";
import type { IconProp } from "../../../icons/types.ts";
// the accept check lives with the dropzone behavior; forms keeps exporting it
export { accepts };

const bytes = (n: number) => applyPipe("bytes", n);

/** Progress reported by an upload function: a fraction 0…1 or { loaded, total }. */
export type UploadProgress = number | { loaded: number; total: number };
/** Uploads one file; resolves with what becomes the value (a URL, an id …). */
export type UploadFn<R = unknown> = (file: File, ctx: { onProgress: (p: UploadProgress) => void; signal: AbortSignal }) => Promise<R> | R;

export interface FileUploadProps<R = unknown> extends ControlProps<unknown> {
  /** "image/*,.pdf" @tr Kabul edilen dosya türleri, ör. "image/*,.pdf". */
  accept?: string | undefined;
  /** Allows choosing several files; the value becomes an array. @tr Birden çok dosya seçilebilir; değer dizi olur. */
  multiple?: boolean | undefined;
  /** Bytes. @tr Dosya başına en büyük boyut, bayt. */
  maxSize?: number | undefined;
  /** Most files allowed (with `multiple`). @tr İzin verilen en fazla dosya sayısı (`multiple` ile). */
  maxFiles?: number | undefined;
  /** Uploads each file: `(file, { onProgress, signal }) => Promise`; the value becomes what it resolves with. @tr Her dosyayı yükler: `(file, { onProgress, signal }) => Promise`; değer onun döndürdüğü sonuç olur. */
  upload?: UploadFn<R> | undefined;
  /** Drop zone text. @tr Bırakma alanının metni. */
  label?: unknown;
  /** Called with the message and the file when a file is rejected or its upload fails. @tr Bir dosya reddedilince ya da yüklemesi başarısız olunca mesaj ve dosyayla çağrılır. */
  onError?: Handler<[message: string, file: File]> | undefined;
  /** The small line under the drop text ("image/* · max 5 MB"): `false` removes it, a node / text / `() => node` replaces it. @tr Bırakma metninin altındaki küçük satır ("image/* · max 5 MB"): `false` kaldırır, düğüm / metin / `() => node` onun yerine geçer. */
  hint?: unknown;
  /** Image thumbnails and audio players of the chosen files: `false` shows only names. @tr Seçilen dosyaların resim küçük görselleri ve ses oynatıcıları: `false` yalnız adları gösterir. */
  preview?: boolean | undefined;
  /** Content of the remove button of a file instead of the "×" (a node, text or `() => node`). @tr Bir dosyanın kaldırma düğmesinde "×" yerine içerik (düğüm, metin ya da `() => node`). */
  removeIcon?: IconProp;
  /** Every other text the control writes; each default is the built-in (translated) text. @tr Denetimin yazdığı diğer tüm metinler; her varsayılan yerleşik (çevrilmiş) metindir. */
  labels?: {
    /** "max 5 MB" in the hint. */
    max?: ((size: string) => string) | undefined;
    /** "Uploaded" next to a finished file. */
    uploaded?: unknown;
    /** "Cancel" on the button of a running upload. */
    cancel?: unknown;
    /** Accessible name of the progress bar. */
    uploading?: ((name: string) => string) | undefined;
    /** Accessible name of the cancel button. */
    cancelUpload?: ((name: string) => string) | undefined;
    /** Accessible name of the remove button of a file. */
    remove?: ((name: string) => string) | undefined;
    /** Rejection messages (also passed to onError). */
    typeNotAllowed?: ((name: string) => string) | undefined;
    tooLarge?: ((name: string, max: string) => string) | undefined;
    tooMany?: ((max: number) => string) | undefined;
  } | undefined;
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
  const inputId = uid("m-file");
  const c = ctl(props);
  onCleanup(() => { for (const u of urls) globalThis.URL?.revokeObjectURL?.(u); urls.clear(); for (const it of untrack(items)) it.ctrl?.abort(); });
  const revoke = (it: Item) => { if (it.url) { globalThis.URL?.revokeObjectURL?.(it.url); urls.delete(it.url); } };
  const preview = (file: File) => {
    if (props.preview === false || !/^(image|audio)\//.test(file.type ?? "") || !globalThis.URL?.createObjectURL) return null;
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
      it.status.set("error"); it.error.set(errorText(err));
    });
  };
  const add = (files: File[]) => {
    const errs: string[] = [];
    // single: the file shown stays until a new one is accepted (a rejected file leaves it)
    let list = [...untrack(items)];
    for (const file of files) {
      let msg: string | null = null;
      const lb = props.labels;
      if (!accepts(file, props.accept)) msg = lb?.typeNotAllowed?.(file.name) ?? t`${file.name}: this file type is not allowed`;
      else if (props.maxSize != null && file.size > props.maxSize) msg = lb?.tooLarge?.(file.name, String(bytes(props.maxSize))) ?? t`${file.name} is too large (max ${bytes(props.maxSize)})`;
      else if (multi && props.maxFiles != null && list.length >= props.maxFiles) msg = lb?.tooMany?.(props.maxFiles) ?? t`At most ${props.maxFiles} files`;
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
    type: "file", id: inputId, class: "m-sr-only", tabindex: "-1", accept: () => props.accept ?? null, multiple: multi,
    disabled: () => locked(props), "aria-hidden": "true",
    onChange: (e: Event) => { const el = e.target as HTMLInputElement; add([...(el.files ?? [])]); el.value = ""; },
  }) as HTMLInputElement;
  const open = () => { if (!props.disabled && !props.readonly) input.click(); };
  const zone = h("div", {
    ...c, role: "button", tabindex: () => (props.disabled ? "-1" : "0"), class: "m-drop", "class:m-drop-over": over, "aria-disabled": () => (props.disabled ? "true" : null),
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => { if (isActivateKey(e)) { e.preventDefault(); open(); } },
    // drops (counted enter / leave, files only) and pasted files: the dropzone behavior; add() checks accept and size
    ref: (x: HTMLElement) => dropzone(x, { onFiles: add, onOver: (on) => over.set(on), paste: true, disabled: () => locked(props) }),
  }, h("span", { class: "m-drop-text" }, () => props.label ?? (multi ? t`Drop files here or click to choose` : t`Drop a file here or click to choose`)),
    () => (props.hint === false || props.hint === null ? null
      : props.hint !== undefined && props.hint !== true ? h("small", { class: "m-hint m-drop-hint" }, ownPart(props.hint, () => null))
      : props.accept || props.maxSize ? h("small", { class: "m-hint m-drop-hint" }, [props.accept, props.maxSize != null ? props.labels?.max?.(String(bytes(props.maxSize))) ?? t`max ${bytes(props.maxSize)}` : null].filter(Boolean).join(" · ")) : null));
  // a file line is a ListRow: preview · name (progress or error under it) · size and state · cancel / remove
  const removeButton = (label: () => string, onClick: () => void) => h(IconButton, { class: "m-file-remove", label, icon: () => ownPart(props.removeIcon, () => xIcon), onClick });
  const row = (itAcc: Accessor<Item>) => {
    const it = itAcc();
    const pct = () => Math.round(it.progress() * 100);
    const name = it.file.name;
    return h(ListRow, {
      as: "li", class: () => cx("m-file", it.status() === "error" && "m-file-error"),
      lead: it.url && it.file.type.startsWith("image/") ? h("img", { class: "m-file-thumb", src: it.url, alt: "" })
        : it.url && it.file.type.startsWith("audio/") ? h("audio", { class: "m-file-audio", src: it.url, controls: true }) : undefined,
      title: name,
      sub: () => (it.status() === "uploading" ? h(Progress, { class: "m-file-progress", value: pct, max: 100, size: "sm", label: props.labels?.uploading?.(name) ?? t`Uploading ${name}`, showValue: true })
        : it.status() === "error" ? h("span", { class: "m-field-error", role: "alert" }, it.error()) : null),
      trail: () => [bytes(it.file.size), it.status() === "done" ? h(Badge, { tone: "success", class: "m-file-ok" }, props.labels?.uploaded ?? t`Uploaded`) : null],
      actions: props.readonly ? undefined : () => (it.status() === "uploading"
        ? h(Button, { variant: "ghost", size: "sm", class: "m-file-cancel", "aria-label": props.labels?.cancelUpload?.(name) ?? t`Cancel upload of ${name}`, onClick: () => remove(it) }, props.labels?.cancel ?? t`Cancel`)
        : removeButton(() => props.labels?.remove?.(name) ?? t`Remove ${name}`, () => remove(it))),
    });
  };
  const existing = () => {
    const v = get();
    if (untrack(items).length || v == null || (Array.isArray(v) && !v.length)) return null;
    const list: unknown[] = Array.isArray(v) ? v : [v];
    return h("ul", { class: "m-files" }, list.map((x) => {
      const name = typeof x === "string" ? x : (x as { name?: string } | null)?.name ?? (x as { url?: string } | null)?.url ?? String(x);
      return h(ListRow, {
        as: "li", class: "m-file", title: name,
        actions: props.readonly ? undefined : removeButton(() => props.labels?.remove?.(name) ?? t`Remove`, () => set(multi ? (untrack(get) as unknown[]).filter((y) => y !== x) : null)),
      });
    }));
  };
  return h("div", { class: () => cx("m-upload", props.class) }, input, zone,
    () => (errors().length ? h("ul", { class: "m-upload-errors", role: "alert" }, errors().map((m) => h("li", { class: "m-field-error" }, m))) : null),
    existing,
    h("ul", { class: "m-files" }, h(For, { each: items, key: "id", children: row })));
}
