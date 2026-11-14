// ThemeEditor body (the editor's first chunk): name, undo / redo, save, apply, base presets, the tabs and the preview
// stage with the draft's variables. The Colors tab (colors.ts), the preview (preview.ts), the start step and saving (persist.ts) and the
// other tabs (panels.ts) load as chunks of their own.
import "./theme-editor.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { lazy } from "../../../dom/lazy.ts";
import { t, messages, dir as docDir } from "../../../core/i18n.ts";
import { cx, uid, setStyle } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model } from "../../../forms/util.ts";
import { Segmented, TextInput, Toggle } from "../../../forms/inputs.ts";
import { Button, IconButton } from "../../../ui/button.ts";
import { Badge } from "../../../ui/badge.ts";
import { Tabs } from "../../../ui/tabs.ts";
import { ThemeSwatch, setColorTheme, colorTheme, theme as appMode } from "../../../ui/theme.ts";
import { undoHistory } from "../../../managers/undo/history.ts";
import { undo as undoIcon } from "../../../icons/glyphs/undo.ts";
import { redo as redoIcon } from "../../../icons/glyphs/redo.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { check } from "../../../icons/glyphs/check.ts";
import * as M from "./model.ts";
import { PRESETS, presetDraft, presetCopy } from "./starts.ts";
import type { ThemeEditorTab, ThemeEditorProps, ThemeEditorContext } from "./types.ts";
import { registerDraft, applyDraft } from "./runtime.ts";
import tr from "./tr.ts";

messages("tr", tr);

const ColorsPanel = lazy(() => import("./colors.ts"), { pick: "ColorsPanel", placeholder: "form", height: "40rem" });
const TypePanel = lazy(() => import("./panels.ts"), { pick: "TypePanel", placeholder: "form", height: "24rem" });
const ShapePanel = lazy(() => import("./panels.ts"), { pick: "ShapePanel", placeholder: "form", height: "24rem" });
const MotionPanel = lazy(() => import("./panels.ts"), { pick: "MotionPanel", placeholder: "form", height: "24rem" });
const ExportPanel = lazy(() => import("./panels.ts"), { pick: "ExportPanel", placeholder: "form", height: "24rem" });
const Preview = lazy(() => import("./preview.ts"), { pick: "ThemePreview", placeholder: "card", height: "34rem" });

/** Theme editor: `<ThemeEditor />`, `<ThemeEditor bind:value={$draft} base="night" storageKey={false} />`. */
export function ThemeEditor(props: ThemeEditorProps): Element {
  const [get, set] = model<M.ThemeDraft | null>(props, null);
  const id = uid("hm-te");
  const key = props.storageKey === false ? null : props.storageKey ?? "theme-editor";
  const start = untrack((): M.ThemeDraft => {
    const v = get();
    if (v) return v;
    return props.base === "scratch" ? M.draftFromColor("#0e7490", t`My theme`) : presetCopy(props.base ?? "hadi");
  });
  const draft = signal<M.ThemeDraft>(start);
  const hist = undoHistory({ mergeMs: 700 });
  const ro = (): boolean => !!props.readonly;
  const L = (): NonNullable<ThemeEditorProps["labels"]> => props.labels ?? {};
  const mode = signal<M.DraftMode>(untrack(appMode) === "dark" ? "dark" : "light");
  const pdir = signal<"ltr" | "rtl">(untrack(docDir) === "rtl" ? "rtl" : "ltr");
  const reduced = signal(false);
  const savedAt = signal(0);
  const applied = signal(false);
  let previous = "";

  const put = (d: M.ThemeDraft): void => { draft.set(d); set(d); if (untrack(applied)) registerDraft(d); };
  effect(() => { const v = get(); if (v && v !== untrack(draft)) { draft.set(v); } });
  const change = (label: string, fn: (d: M.ThemeDraft) => M.ThemeDraft, merge?: string): void => {
    if (ro()) return;
    const prev = draft.peek(), next = fn(prev);
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    put(next);
    hist.push({ label, undo: () => put(prev), redo: () => put(next), ...(merge ? { merge } : {}) });
  };
  const save = (): void => {
    const d = draft.peek();
    if (key) void persist.then((p) => p.writeSaved(key, d));
    hist.markSaved();
    savedAt.set(Date.now());
    props.onSave?.(d);
  };
  const dirty = (): boolean => !hist.atSaved();
  // the start step (share link, saved draft), saving and the unsaved-change warning load right after the editor shows;
  // their draft replaces the first one unless a value was given or something was edited in the meantime
  const persist = import("./persist.ts");
  let gone = false, off: (() => void) | null = null;
  onCleanup(() => { gone = true; off?.(); });
  const given = untrack(() => !!get());
  void persist.then((p) => {
    if (gone) return;
    const found = given ? null : p.startDraft(props.share !== false, key);
    if (found && !hist.canUndo()) { draft.set(found); set(found); }
    if (props.warnUnsaved !== false) off = p.trackDirty(id, dirty, L().editor ?? t`Theme editor`, save);
  });
  const toggleApply = (): void => {
    if (applied.peek()) { applied.set(false); setColorTheme(previous || "hadi"); return; }
    previous = colorTheme();
    applied.set(true);
    applyDraft(draft.peek());
  };
  const ctx: ThemeEditorContext = { draft, change, mode, dir: pdir, reduced, readonly: ro };

  // ------------------------------------------------------------------ top bar: name, history, save, apply
  const bar = h("div", { class: "hm-te-bar" },
    props.nameField === false ? null : h("div", { class: "hm-te-title" },
      h(TextInput, {
        class: "hm-te-name", "aria-label": L().name ?? t`Theme name`, get readonly() { return ro(); },
        get value() { return draft().name; },
        onChange: (v: string) => change(t`Rename`, (d) => ({ ...d, name: v, id: M.slug(v || "theme") }), "name"),
      }),
      h("code", { class: "hm-te-id", "aria-label": () => t`Theme id: ${draft().id}` }, () => `data-hm-theme="${draft().id}"`)),
    h("div", { class: "hm-te-actions" },
      props.historyButtons === false ? null : h(IconButton, { class: "hm-te-undo", icon: undoIcon, label: () => { const l = hist.past()[0], u = L().undo; return u ? (l ? `${u}: ${l}` : u) : l ? t`Undo: ${l}` : t`Undo`; }, disabled: () => !hist.canUndo(), onClick: () => void hist.undo() }),
      props.historyButtons === false ? null : h(IconButton, { class: "hm-te-redo", icon: redoIcon, label: () => { const l = hist.future()[0], r = L().redo; return r ? (l ? `${r}: ${l}` : r) : l ? t`Redo: ${l}` : t`Redo`; }, disabled: () => !hist.canRedo(), onClick: () => void hist.redo() }),
      () => (dirty() ? h(Badge, { tone: "warn", dot: true }, L().unsaved ?? t`Unsaved`) : savedAt() ? h(Badge, { tone: "success", dot: true }, L().saved ?? t`Saved`) : null),
      key ? h(Button, { class: "hm-te-save", variant: "secondary", size: "sm", disabled: () => !dirty() || ro(), onClick: save }, L().save ?? t`Save`) : null,
      props.applyButton === false ? null : h(Button, { class: "hm-te-apply", variant: () => (applied() ? "secondary" : "primary"), size: "sm", icon: () => (applied() ? check : null), "aria-pressed": () => String(applied()), onClick: toggleApply },
        () => (applied() ? L().applied ?? t`Applied to the app` : L().apply ?? t`Apply to the app`))));

  // ------------------------------------------------------------------ base presets
  const bases = props.presets === false ? null : h("div", { class: "hm-te-bases", role: "group", "aria-label": L().startFrom ?? t`Start from` },
    h("span", { class: "hm-te-bases-label" }, L().startFrom ?? t`Start from`),
    PRESETS.map((p) => h("button", {
      type: "button", class: () => cx("hm-te-base", draft().base === p.id && "is-active"), "aria-pressed": () => String(draft().base === p.id), disabled: ro,
      onClick: () => change(t`Base: ${t(p.name)}`, (d) => { const n = presetCopy(p.id); return d.base === null || d.name === t`${t(presetDraft(d.base ?? "hadi").name)} (copy)` ? n : { ...n, id: d.id, name: d.name }; }),
    }, h(ThemeSwatch, { id: p.id }), h("span", {}, () => t(p.name)))),
    h("button", {
      type: "button", class: () => cx("hm-te-base", "hm-te-scratch", draft().base === null && "is-active"), "aria-pressed": () => String(draft().base === null), disabled: ro,
      onClick: () => change(t`From scratch`, (d) => ({ ...M.draftFromColor(d.light.primary, d.name), id: d.id })),
    }, glyph(sparkles), h("span", {}, L().scratch ?? t`From scratch`)));

  const tabsAll: { id: ThemeEditorTab; label: () => string; content: () => unknown }[] = [
    { id: "colors", label: () => L().tabs?.colors ?? t`Colors`, content: () => h(ColorsPanel, { ctx }) },
    { id: "type", label: () => L().tabs?.type ?? t`Typography`, content: () => h(TypePanel, { ctx }) },
    { id: "shape", label: () => L().tabs?.shape ?? t`Shape`, content: () => h(ShapePanel, { ctx }) },
    { id: "motion", label: () => L().tabs?.motion ?? t`Motion`, content: () => h(MotionPanel, { ctx }) },
    { id: "export", label: () => L().tabs?.export ?? t`Export`, content: () => h(ExportPanel, { ctx }) },
  ];
  const tabs = tabsAll.filter((x) => !props.tabs || props.tabs.includes(x.id));
  const tab = signal<string>(tabs[0]?.id ?? "colors");

  // ------------------------------------------------------------------ preview stage (the draft's variables, scoped)
  const scope = h("div", {
    class: () => cx("hm-te-scope", reduced() && "is-reduced"), "data-hm-theme": () => draft().id, dir: pdir,
    role: "region", "aria-label": L().preview ?? t`Theme preview`,
  }, h(Preview, { ctx })) as HTMLElement;
  let shown: string[] = [];
  effect(() => {
    const vars = M.draftVars(draft(), mode());
    if (reduced()) Object.assign(vars, { "--hm-dur-fast": "0ms", "--hm-dur": "0ms", "--hm-dur-slow": "0ms" });
    setStyle(scope, Object.fromEntries(shown.filter((k) => !(k in vars)).map((k) => [k, null])));
    setStyle(scope, vars);
    shown = Object.keys(vars);
  });
  const stage = props.preview === false ? null : h("div", { class: "hm-te-stage" },
    props.previewControls === false ? null : h("div", { class: "hm-te-stage-bar" },
      h(Segmented, { "aria-label": L().previewMode ?? t`Preview mode`, get value() { return mode(); }, onChange: (v: M.DraftMode | null) => { if (v) mode.set(v); }, options: [{ value: "light", label: L().light ?? t`Light` }, { value: "dark", label: L().dark ?? t`Dark` }] }),
      h(Segmented, { "aria-label": L().previewDirection ?? t`Preview direction`, get value() { return pdir(); }, onChange: (v: "ltr" | "rtl" | null) => { if (v) pdir.set(v); }, options: [{ value: "ltr", label: "LTR" }, { value: "rtl", label: "RTL" }] }),
      h(Toggle, { get value() { return reduced(); }, onChange: (v: boolean) => reduced.set(v), label: L().reducedMotion ?? t`Reduced motion` })),
    scope);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
    const el = e.target as HTMLElement;
    if (el.closest("input[type=text], input:not([type]), textarea, [contenteditable]")) return;
    e.preventDefault();
    void (e.shiftKey ? hist.redo() : hist.undo());
  };
  return h("div", { class: () => cx("hm-te", props.preview === false && "hm-te-solo", props.class), role: "group", "aria-label": L().editor ?? t`Theme editor`, onKeyDown },
    bar, bases,
    h("div", { class: "hm-te-body" },
      h("div", { class: "hm-te-panel" }, h(Tabs, { tabs, label: L().sections ?? t`Theme sections`, get value() { return tab(); }, onChange: (v: string) => tab.set(v) })),
      stage)) as Element;
}
