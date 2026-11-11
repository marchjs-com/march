// FileUpload: drag & drop or click, accept / maxSize checks, image and audio previews (object URLs revoked on cleanup),
// progress and cancel when an `upload(file, { onProgress, signal })` function is given.
import { signal, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.js";
import { For } from "../dom/flow.js";
import { t } from "../core/i18n.ts";
import { applyPipe } from "../core/pipes.js";
import { model, ctl, cx, uid } from "./util.js";

/** Does `file` match an accept list like "image/*,.pdf,application/json"? */
export function accepts(file, accept) {
  if (!accept) return true;
  const name = (file.name ?? "").toLowerCase(), type = (file.type ?? "").toLowerCase();
  return accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((a) =>
    a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) : type === a);
}

const bytes = (n) => applyPipe("bytes", n);

/**
 * Props: accept, multiple, maxSize (bytes), maxFiles, upload(file, { onProgress(fraction|{loaded,total}), signal }) → Promise<result>,
 * label (drop zone text). Value: without `upload` the File (or File[] with multiple); with `upload` the result(s).
 * onError(message, file) is called for rejected files.
 */
export function FileUpload(props) {
  const multi = !!props.multiple;
  const [get, set] = model(props, multi ? [] : null);
  const items = signal([], { equals: false });
  const errors = signal([]);
  const over = signal(false);
  const urls = new Set();
  const inputId = uid("hm-file");
  const c = ctl(props);
  onCleanup(() => { for (const u of urls) globalThis.URL?.revokeObjectURL?.(u); urls.clear(); for (const it of untrack(items)) it.ctrl?.abort(); });
  const revoke = (it) => { if (it.url) { globalThis.URL?.revokeObjectURL?.(it.url); urls.delete(it.url); } };
  const preview = (file) => {
    if (!/^(image|audio)\//.test(file.type ?? "") || !globalThis.URL?.createObjectURL) return null;
    try { const u = URL.createObjectURL(file); urls.add(u); return u; } catch { return null; }
  };
  const emit = () => {
    const list = untrack(items);
    const vals = props.upload ? list.filter((x) => x.status() === "done").map((x) => x.result) : list.map((x) => x.file);
    set(multi ? vals : vals[vals.length - 1] ?? null);
  };
  const start = (it) => {
    const ctrl = new AbortController();
    it.ctrl = ctrl;
    it.status.set("uploading");
    Promise.resolve().then(() => props.upload(it.file, {
      signal: ctrl.signal,
      onProgress: (p) => { const f = typeof p === "number" ? p : p && p.total ? p.loaded / p.total : 0; it.progress.set(Math.max(0, Math.min(1, f))); },
    })).then((res) => {
      if (ctrl.signal.aborted) return;
      it.result = res; it.progress.set(1); it.status.set("done"); emit();
    }, (err) => {
      if (ctrl.signal.aborted) return;
      it.status.set("error"); it.error.set(err?.message ?? String(err));
    });
  };
  const add = (files) => {
    const errs = [];
    let list = multi ? [...untrack(items)] : [];
    for (const file of files) {
      let msg = null;
      if (!accepts(file, props.accept)) msg = t`${file.name}: this file type is not allowed`;
      else if (props.maxSize != null && file.size > props.maxSize) msg = t`${file.name} is too large (max ${bytes(props.maxSize)})`;
      else if (multi && props.maxFiles != null && list.length >= props.maxFiles) msg = t`At most ${props.maxFiles} files`;
      if (msg) { errs.push(msg); props.onError?.(msg, file); continue; }
      const it = { id: uid("f"), file, url: preview(file), status: signal("ready"), progress: signal(0), error: signal(null), result: undefined, ctrl: null };
      if (!multi) for (const old of list) { old.ctrl?.abort(); revoke(old); }
      list = multi ? [...list, it] : [it];
      if (!multi) break;
    }
    errors.set(errs);
    items.set(list);
    for (const it of list) if (props.upload && untrack(it.status) === "ready") start(it);
    emit();
  };
  const remove = (it) => { it.ctrl?.abort(); revoke(it); items.set(untrack(items).filter((x) => x !== it)); emit(); };
  let input;
  input = h("input", {
    type: "file", id: inputId, class: "hm-sr-only", tabindex: "-1", accept: () => props.accept ?? null, multiple: multi,
    disabled: () => !!(props.disabled || props.readonly), "aria-hidden": "true",
    onChange: (e) => { add([...(e.target.files ?? [])]); e.target.value = ""; },
  });
  const open = () => { if (!props.disabled && !props.readonly) input.click(); };
  const zone = h("div", {
    ...c, role: "button", tabindex: () => (props.disabled ? "-1" : "0"), class: "hm-drop", "class:hm-drop-over": over, "aria-disabled": () => (props.disabled ? "true" : null),
    onClick: open,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
    onDragEnter: (e) => { e.preventDefault(); over.set(true); },
    onDragOver: (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; over.set(true); },
    onDragLeave: () => over.set(false),
    onDrop: (e) => { e.preventDefault(); over.set(false); if (!props.disabled && !props.readonly) add([...(e.dataTransfer?.files ?? [])]); },
  }, h("span", { class: "hm-drop-text" }, () => props.label ?? (multi ? t`Drop files here or click to choose` : t`Drop a file here or click to choose`)),
    () => (props.accept || props.maxSize ? h("small", { class: "hm-hint" }, [props.accept, props.maxSize != null ? t`max ${bytes(props.maxSize)}` : null].filter(Boolean).join(" · ")) : null));
  const row = (itAcc) => {
    const it = itAcc();
    const pct = () => Math.round(it.progress() * 100);
    return h("li", { class: "hm-file", "class:hm-file-error": () => it.status() === "error" },
      it.url && it.file.type.startsWith("image/") ? h("img", { class: "hm-file-thumb", src: it.url, alt: "" }) : null,
      it.url && it.file.type.startsWith("audio/") ? h("audio", { class: "hm-file-audio", src: it.url, controls: true }) : null,
      h("span", { class: "hm-file-name" }, it.file.name), h("small", { class: "hm-hint" }, bytes(it.file.size)),
      () => (it.status() === "uploading" ? h("div", { class: "hm-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": () => String(pct()), "aria-label": t`Uploading ${it.file.name}` },
        h("div", { class: "hm-progress-bar", style: () => ({ width: `${pct()}%` }) })) : null),
      () => (it.status() === "error" ? h("span", { class: "hm-field-error", role: "alert" }, it.error()) : null),
      () => (it.status() === "done" ? h("span", { class: "hm-file-ok" }, t`Uploaded`) : null),
      props.readonly ? null : h("button", { type: "button", class: "hm-icon-btn", "aria-label": () => (it.status() === "uploading" ? t`Cancel upload of ${it.file.name}` : t`Remove ${it.file.name}`), onClick: () => remove(it) },
        () => (it.status() === "uploading" ? t`Cancel` : "×")));
  };
  const existing = () => {
    const v = get();
    if (untrack(items).length || v == null || (Array.isArray(v) && !v.length)) return null;
    const list = Array.isArray(v) ? v : [v];
    return h("ul", { class: "hm-files" }, list.map((x) => h("li", { class: "hm-file" },
      h("span", { class: "hm-file-name" }, typeof x === "string" ? x : x?.name ?? x?.url ?? String(x)),
      props.readonly ? null : h("button", { type: "button", class: "hm-icon-btn", "aria-label": t`Remove`, onClick: () => set(multi ? untrack(get).filter((y) => y !== x) : null) }, "×"))));
  };
  return h("div", { class: cx("hm-upload", props.class) }, input, zone,
    () => (errors().length ? h("ul", { class: "hm-upload-errors", role: "alert" }, errors().map((m) => h("li", { class: "hm-field-error" }, m))) : null),
    existing,
    h("ul", { class: "hm-files" }, h(For, { each: items, key: "id" }, row)));
}
