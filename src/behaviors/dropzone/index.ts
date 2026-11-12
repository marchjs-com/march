// hadi-march/behaviors/dropzone — an element that takes files dropped on it (and, if asked, pasted into it):
//   dropzone(zone, { onFiles: (files) => upload(files), onOver: (on) => over.set(on), accept: "image/*,.pdf" })
//   <div use:dropzone={[dropzone, { … }]}>
// Enter / leave are counted, so moving over the zone's own children does not flicker the "over" state; only drags that
// carry files count (a dragged link or text is left alone); `accept` filters like <input accept> and the rest go to
// onReject. Keyboard and click stay with the component (a dropzone is never the only way to add a file).
import { listen } from "../../core/util.ts";

/** Options of dropzone(). */
export interface DropzoneOptions {
  /** Files dropped (or pasted) that pass `accept`. */
  onFiles: (files: File[]) => void;
  /** true while files are dragged over the zone. */
  onOver?: ((over: boolean) => void) | undefined;
  /** Same syntax as <input accept>: "image/*", ".pdf", "text/csv", comma separated. */
  accept?: string | undefined;
  /** Files refused by `accept`. */
  onReject?: ((files: File[]) => void) | undefined;
  /** Only the first file (default false). */
  single?: boolean | undefined;
  /** Also take files pasted while focus is inside the zone (default false). */
  paste?: boolean | undefined;
  /** Off while it returns true. */
  disabled?: (() => boolean) | undefined;
}

/** True when `file` matches an <input accept> list ("image/*", ".pdf", "text/csv"); an empty list takes all. */
export function accepts(file: { name?: string; type?: string }, accept: string | null | undefined): boolean {
  const list = (accept ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const name = (file.name ?? "").toLowerCase(), type = (file.type ?? "").toLowerCase();
  return list.some((a) => (a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) : type === a));
}

// a drag that carries files (types lists "Files"; a bare drop event may only have the files)
const hasFiles = (e: DragEvent): boolean => {
  const dt = e.dataTransfer;
  if (!dt) return false;
  return dt.types ? Array.from(dt.types as ArrayLike<string>).includes("Files") : !!dt.files?.length;
};

/** Make `el` take dropped files. Returns the cleanup (also run with the current owner). */
export function dropzone(el: Element, o: DropzoneOptions): () => void {
  let depth = 0;
  const over = (on: boolean): void => { el.classList.toggle("is-drop-over", on); o.onOver?.(on); };
  const take = (list: ArrayLike<File> | null | undefined): void => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const ok = files.filter((f) => accepts(f, o.accept)), bad = files.filter((f) => !accepts(f, o.accept));
    if (bad.length) o.onReject?.(bad);
    if (ok.length) o.onFiles(o.single ? ok.slice(0, 1) : ok);
  };
  return listen(el, {
    dragenter: (e: DragEvent) => {
      if (o.disabled?.() || !hasFiles(e)) return;
      e.preventDefault();
      if (depth++ === 0) over(true);
    },
    dragover: (e: DragEvent) => {
      if (o.disabled?.() || !hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    dragleave: (e: DragEvent) => {
      if (!hasFiles(e) || depth === 0) return;
      if (--depth === 0) over(false);
    },
    drop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const was = depth > 0;
      depth = 0;
      if (was) over(false);
      if (!o.disabled?.()) take(e.dataTransfer?.files);
    },
    paste: o.paste ? (e: ClipboardEvent) => {
      if (o.disabled?.()) return;
      const files = e.clipboardData?.files;
      if (files && files.length) { e.preventDefault(); take(files); }
    } : undefined,
  });
}
