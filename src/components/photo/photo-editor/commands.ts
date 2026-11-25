// The editor's built-in commands and the menu bar built from them. Each command has an id, an English label (the UI
// translates it), a menu path and a default shortcut (remappable in Preferences › Keyboard). Menus, the command
// palette, context menus, the shortcut map and the actions recorder all read this one list.

import { untrack } from "../../../core/reactive.ts";
import { select, BLEND_MODES, deepCopyLayer, hasRaster, isContainer, Mask, renderRegion, type ImageDocument, type Layer, type RGBA } from "../../../image/doc/index.ts";
import type { Editor, EditorCommand } from "./editor.ts";

const docOpen = (ed: Editor): boolean => !!ed.doc;
const hasSel = (ed: Editor): boolean => !!ed.doc?.selection;
const activePixel = (ed: Editor): boolean => { const l = ed.doc?.active; return !!l && hasRaster(l) && !l.locks.pixels; };
const activeLayer = (ed: Editor): Layer | null => ed.doc?.active ?? null;
const sel = (ed: Editor): string[] => ed.doc?.selected ?? [];
const view = (ed: Editor): import("./view.ts").CanvasViewApi | undefined => ed.shared.view as import("./view.ts").CanvasViewApi | undefined;
const ui = (ed: Editor, what: string, data?: unknown): unknown => (ed.shared.ui as ((w: string, d?: unknown) => unknown) | undefined)?.(what, data);
const setView = (ed: Editor, patch: Partial<import("./editor.ts").ViewState>): void => { const e = ed.entry(); if (e) e.view.set({ ...untrack(e.view), ...patch }); };
const flag = (ed: Editor, k: keyof import("./editor.ts").ViewState): boolean => { const e = ed.entry(); return !!e && !!untrack(e.view)[k]; };

/** Every built-in command. Area modules (adjustments, filters, transforms, type…) add theirs with ed.addCommand. */
export function coreCommands(): EditorCommand[] {
  const c = (id: string, label: string, menu: string, run: EditorCommand["run"], o: Partial<EditorCommand> = {}): EditorCommand => ({ id, label, menu, run, enabled: docOpen, ...o });
  return [
    // ——— File
    c("file.new", "New…", "File", (ed) => ui(ed, "new"), { key: "mod+n", enabled: undefined }),
    c("file.open", "Open…", "File", (ed) => ui(ed, "open"), { key: "mod+o", enabled: undefined }),
    c("file.close", "Close", "File", (ed) => { const e = ed.entry(); if (e) ui(ed, "close", e.id); }, { key: "mod+w" }),
    c("file.closeAll", "Close All", "File", (ed) => { for (const e of untrack(ed.docs)) ui(ed, "close", e.id); }, { key: "alt+mod+w", sep: true }),
    c("file.save", "Save", "File", (ed) => ui(ed, "save"), { key: "mod+s" }),
    c("file.saveAs", "Save As…", "File", (ed) => ui(ed, "saveAs"), { key: "shift+mod+s" }),
    c("file.revert", "Revert", "File", (ed) => ed.doc?.history.jump(0), { key: "f12", sep: true }),
    c("file.export", "Export As…", "File/Export", (ed) => ui(ed, "export"), { key: "alt+shift+mod+w" }),
    c("file.quickExport", "Quick Export as PNG", "File/Export", (ed) => ui(ed, "quickExport")),
    c("file.exportWeb", "Export for Web…", "File/Export", (ed) => ui(ed, "export", { web: true }), { key: "alt+shift+mod+s" }),
    c("file.exportLayers", "Layers to Files…", "File/Export", (ed) => ui(ed, "export", { per: "layer" })),
    c("file.exportArtboards", "Artboards to Files…", "File/Export", (ed) => ui(ed, "export", { per: "artboard" }), { sep: true }),
    c("file.place", "Place Embedded…", "File", (ed) => ui(ed, "place")),
    c("file.import", "Variable Data Sets…", "File/Import", (ed) => ui(ed, "dataSets")),
    c("file.automate", "Batch…", "File/Automate", (ed) => ui(ed, "batch")),
    c("file.info", "File Info…", "File", (ed) => ui(ed, "fileInfo"), { key: "alt+shift+mod+i", sep: true }),
    c("file.print", "Print…", "File", (ed) => ui(ed, "print"), { key: "mod+p" }),

    // ——— Edit
    c("edit.undo", "Undo", "Edit", (ed) => ed.doc?.undo(), { key: "mod+z", enabled: (ed) => !!ed.doc?.history.canUndo() }),
    c("edit.redo", "Redo", "Edit", (ed) => ed.doc?.redo(), { key: "shift+mod+z", enabled: (ed) => !!ed.doc?.history.canRedo() }),
    c("edit.stepBack", "Step Backward", "Edit", (ed) => ed.doc?.undo(), { key: "alt+mod+z", hidden: true }),
    c("edit.fade", "Fade…", "Edit", (ed) => ui(ed, "fade"), { key: "shift+mod+f", sep: true }),
    c("edit.cut", "Cut", "Edit", (ed) => { if (ed.copy()) ed.fillSelection(null); }, { key: "mod+x", enabled: activePixel }),
    c("edit.copy", "Copy", "Edit", (ed) => ed.copy(), { key: "mod+c" }),
    c("edit.copyMerged", "Copy Merged", "Edit", (ed) => ed.copy(true), { key: "shift+mod+c" }),
    c("edit.paste", "Paste", "Edit", (ed) => ed.paste(false), { key: "mod+v", enabled: (ed) => docOpen(ed) && !!ed.clip }),
    c("edit.pasteInPlace", "Paste in Place", "Edit/Paste Special", (ed) => ed.paste(true), { key: "shift+mod+v", enabled: (ed) => docOpen(ed) && !!ed.clip }),
    c("edit.clear", "Clear", "Edit", (ed) => ed.fillSelection(null), { key: "delete", enabled: activePixel, sep: true }),
    c("edit.fill", "Fill…", "Edit", (ed) => ui(ed, "fill"), { key: "shift+f5", enabled: activePixel }),
    c("edit.fillFg", "Fill with Foreground", "Edit", (ed) => ed.fillSelection(untrack(ed.fg)), { key: "alt+backspace", enabled: activePixel, hidden: true }),
    c("edit.fillBg", "Fill with Background", "Edit", (ed) => ed.fillSelection(untrack(ed.bg)), { key: "mod+backspace", enabled: activePixel, hidden: true }),
    c("edit.stroke", "Stroke…", "Edit", (ed) => ui(ed, "stroke"), { enabled: activePixel }),
    c("edit.contentFill", "Content-Aware Fill…", "Edit", (ed) => ui(ed, "contentFill"), { enabled: (ed) => activePixel(ed) && hasSel(ed) }),
    c("edit.generativeFill", "Generative Fill…", "Edit", (ed) => ui(ed, "generativeFill"), { enabled: (ed) => hasSel(ed) && !!ed.shared.ai, sep: true }),
    c("edit.freeTransform", "Free Transform", "Edit", (ed) => ed.setTool("transform"), { key: "mod+t" }),
    c("edit.transformAgain", "Again", "Edit/Transform", (ed) => ed.run("transform.again"), { key: "shift+mod+t" }),
    c("edit.puppet", "Puppet Warp", "Edit", (ed) => ed.setTool("puppet")),
    c("edit.perspectiveWarp", "Perspective Warp", "Edit", (ed) => ed.setTool("perspective-warp")),
    c("edit.contentScale", "Content-Aware Scale", "Edit", (ed) => ui(ed, "contentScale"), { key: "alt+shift+mod+c" }),
    c("edit.autoAlign", "Auto-Align Layers…", "Edit", (ed) => ui(ed, "autoAlign"), { enabled: (ed) => sel(ed).length > 1 }),
    c("edit.autoBlend", "Auto-Blend Layers…", "Edit", (ed) => ui(ed, "autoBlend"), { enabled: (ed) => sel(ed).length > 1, sep: true }),
    c("edit.definePattern", "Define Pattern…", "Edit", (ed) => ui(ed, "definePattern")),
    c("edit.defineBrush", "Define Brush Preset…", "Edit", (ed) => ui(ed, "defineBrush"), { sep: true }),
    c("edit.purge", "Purge Histories", "Edit/Purge", (ed) => ed.doc?.history.clear()),
    c("edit.colorSettings", "Color Settings…", "Edit", (ed) => ui(ed, "colorSettings"), { key: "shift+mod+k", enabled: undefined }),
    c("edit.assignProfile", "Assign Profile…", "Edit", (ed) => ui(ed, "assignProfile")),
    c("edit.convertProfile", "Convert to Profile…", "Edit", (ed) => ui(ed, "convertProfile"), { sep: true }),
    c("edit.shortcuts", "Keyboard Shortcuts…", "Edit", (ed) => ui(ed, "shortcuts"), { key: "alt+shift+mod+k", enabled: undefined }),
    c("edit.prefs", "Preferences…", "Edit", (ed) => ui(ed, "prefs"), { key: "mod+k", enabled: undefined }),

    // ——— Image
    c("image.mode.rgb", "RGB Color", "Image/Mode", (ed) => ui(ed, "mode", "rgb"), { checked: (ed) => ed.doc?.mode === "rgb" }),
    c("image.mode.gray", "Grayscale", "Image/Mode", (ed) => ui(ed, "mode", "gray"), { checked: (ed) => ed.doc?.mode === "gray" }),
    c("image.mode.cmyk", "CMYK Color", "Image/Mode", (ed) => ui(ed, "mode", "cmyk"), { checked: (ed) => ed.doc?.mode === "cmyk" }),
    c("image.mode.lab", "Lab Color", "Image/Mode", (ed) => ui(ed, "mode", "lab"), { checked: (ed) => ed.doc?.mode === "lab" }),
    c("image.mode.indexed", "Indexed Color…", "Image/Mode", (ed) => ui(ed, "mode", "indexed"), { checked: (ed) => ed.doc?.mode === "indexed" }),
    c("image.mode.bitmap", "Bitmap…", "Image/Mode", (ed) => ui(ed, "mode", "bitmap"), { checked: (ed) => ed.doc?.mode === "bitmap", sep: true }),
    c("image.depth.8", "8 Bits/Channel", "Image/Mode", (ed) => ui(ed, "depth", 8), { checked: (ed) => ed.doc?.depth === 8 }),
    c("image.depth.16", "16 Bits/Channel", "Image/Mode", (ed) => ui(ed, "depth", 16), { checked: (ed) => ed.doc?.depth === 16 }),
    c("image.depth.32", "32 Bits/Channel", "Image/Mode", (ed) => ui(ed, "depth", 32), { checked: (ed) => ed.doc?.depth === 32 }),
    c("image.autoTone", "Auto Tone", "Image", (ed) => ed.run("adjust.autoTone"), { key: "shift+mod+l" }),
    c("image.autoContrast", "Auto Contrast", "Image", (ed) => ed.run("adjust.autoContrast"), { key: "alt+shift+mod+l" }),
    c("image.autoColor", "Auto Color", "Image", (ed) => ed.run("adjust.autoColor"), { key: "shift+mod+b", sep: true }),
    c("image.size", "Image Size…", "Image", (ed) => ui(ed, "imageSize"), { key: "alt+mod+i" }),
    c("image.canvas", "Canvas Size…", "Image", (ed) => ui(ed, "canvasSize"), { key: "alt+mod+c" }),
    c("image.rotate180", "180°", "Image/Image Rotation", (ed) => ed.run("canvas.rotate", 180)),
    c("image.rotateCw", "90° Clockwise", "Image/Image Rotation", (ed) => ed.run("canvas.rotate", 90)),
    c("image.rotateCcw", "90° Counter Clockwise", "Image/Image Rotation", (ed) => ed.run("canvas.rotate", -90)),
    c("image.rotateAny", "Arbitrary…", "Image/Image Rotation", (ed) => ui(ed, "rotateAny"), { sep: true }),
    c("image.flipH", "Flip Canvas Horizontal", "Image/Image Rotation", (ed) => ed.run("canvas.flip", "h")),
    c("image.flipV", "Flip Canvas Vertical", "Image/Image Rotation", (ed) => ed.run("canvas.flip", "v")),
    c("image.crop", "Crop", "Image", (ed) => ed.run("canvas.cropToSelection"), { enabled: hasSel }),
    c("image.trim", "Trim…", "Image", (ed) => ui(ed, "trim")),
    c("image.revealAll", "Reveal All", "Image", (ed) => ed.run("canvas.revealAll"), { sep: true }),
    c("image.duplicate", "Duplicate…", "Image", (ed) => { const d = ed.doc; if (d) ui(ed, "duplicateDoc", d); }),
    c("image.applyImage", "Apply Image…", "Image", (ed) => ui(ed, "applyImage")),
    c("image.calculations", "Calculations…", "Image", (ed) => ui(ed, "calculations"), { sep: true }),
    c("image.variables", "Define…", "Image/Variables", (ed) => ui(ed, "variables")),
    c("image.dataSets", "Data Sets…", "Image/Variables", (ed) => ui(ed, "dataSets")),

    // ——— Layer
    c("layer.new", "Layer…", "Layer/New", (ed) => ed.change("New Layer", (d) => d.add(d.newPixelLayer(d.nextName()))), { key: "shift+mod+n" }),
    c("layer.newQuick", "New Layer", "Layer/New", (ed) => ed.change("New Layer", (d) => d.add(d.newPixelLayer(d.nextName()))), { key: "alt+shift+mod+n", hidden: true }),
    c("layer.fromBackground", "Layer from Background", "Layer/New", (ed) => ed.change("Layer from Background", (d) => d.unlockBackground()), { enabled: (ed) => !!ed.doc && !!ed.doc.layers[0] && ed.doc.isBackground(ed.doc.layers[0]!) }),
    c("layer.group", "Group Layers", "Layer", (ed) => ed.change("Group Layers", (d) => d.group(d.selected.length ? d.selected : d.activeId ? [d.activeId] : [])), { key: "mod+g" }),
    c("layer.ungroup", "Ungroup Layers", "Layer", (ed) => { const l = activeLayer(ed); if (l && isContainer(l)) ed.change("Ungroup Layers", (d) => d.ungroup(l.id)); }, { key: "shift+mod+g", enabled: (ed) => { const l = activeLayer(ed); return !!l && isContainer(l); } }),
    c("layer.viaCopy", "Layer via Copy", "Layer/New", (ed) => {
      const d = ed.doc;
      if (!d) return;
      if (!d.selection) { const id = d.activeId; if (id) d.change("Duplicate Layer", () => d.duplicate(id)); return; }
      if (ed.copy()) ed.paste(true);
    }, { key: "mod+j" }),
    c("layer.viaCut", "Layer via Cut", "Layer/New", (ed) => { if (ed.doc?.selection && ed.copy()) { ed.doc.begin("Layer via Cut"); ed.fillSelection(null); ed.paste(true); ed.doc.commit(); } }, { key: "shift+mod+j", enabled: (ed) => hasSel(ed) && activePixel(ed) }),
    c("layer.duplicate", "Duplicate Layer…", "Layer", (ed) => { const id = ed.doc?.activeId; if (id) ed.change("Duplicate Layer", (d) => d.duplicate(id)); }),
    c("layer.delete", "Delete Layer", "Layer", (ed) => ed.change("Delete Layer", (d) => d.remove(d.selected.length ? d.selected : d.activeId ? [d.activeId] : [])), { sep: true }),
    c("layer.style", "Layer Style…", "Layer/Layer Style", (ed) => ui(ed, "layerStyle"), { enabled: (ed) => !!activeLayer(ed) }),
    c("layer.style.copy", "Copy Layer Style", "Layer/Layer Style", (ed) => { ed.shared.styleClip = structuredCloneSafe(activeLayer(ed)?.styles); }),
    c("layer.style.paste", "Paste Layer Style", "Layer/Layer Style", (ed) => ed.change("Paste Layer Style", (d) => { for (const id of d.selected) { const l = d.find(id); if (l) l.styles = structuredCloneSafe(ed.shared.styleClip) as never; } }), { enabled: (ed) => !!ed.shared.styleClip }),
    c("layer.style.clear", "Clear Layer Style", "Layer/Layer Style", (ed) => ed.change("Clear Layer Style", (d) => { for (const id of d.selected) { const l = d.find(id); if (l) delete l.styles; } })),
    c("layer.newFill.solid", "Solid Color…", "Layer/New Fill Layer", (ed) => ed.change("Color Fill", (d) => d.add(d.newFillLayer({ type: "solid", color: untrack(ed.fg) }, "Color Fill")))),
    c("layer.newFill.gradient", "Gradient…", "Layer/New Fill Layer", (ed) => ed.change("Gradient Fill", (d) => d.add(d.newFillLayer({ type: "gradient", gradient: { type: "linear", from: [0, 0.5], to: [1, 0.5], relative: true, stops: [{ at: 0, color: untrack(ed.fg) }, { at: 1, color: untrack(ed.bg) }] } }, "Gradient Fill")))),
    c("layer.newFill.pattern", "Pattern…", "Layer/New Fill Layer", (ed) => ui(ed, "patternFill")),
    c("layer.newAdjustment", "Adjustment…", "Layer/New Adjustment Layer", (ed, id) => ui(ed, "adjustmentLayer", id), { hidden: true }),
    c("layer.mask.reveal", "Reveal All", "Layer/Layer Mask", (ed) => ed.change("Add Layer Mask", (d) => { const l = d.active; if (l) l.mask = { mask: maskFull(d, 255), enabled: true, linked: true, density: 1, feather: 0 }; }), { enabled: (ed) => !!activeLayer(ed) && !activeLayer(ed)!.mask }),
    c("layer.mask.hide", "Hide All", "Layer/Layer Mask", (ed) => ed.change("Add Layer Mask", (d) => { const l = d.active; if (l) l.mask = { mask: maskFull(d, 0), enabled: true, linked: true, density: 1, feather: 0 }; }), { enabled: (ed) => !!activeLayer(ed) && !activeLayer(ed)!.mask }),
    c("layer.mask.selection", "Reveal Selection", "Layer/Layer Mask", (ed) => ed.change("Add Layer Mask", (d) => { const l = d.active; if (l && d.selection) l.mask = { mask: d.selection.clone(), enabled: true, linked: true, density: 1, feather: 0 }; }), { enabled: (ed) => hasSel(ed) && !!activeLayer(ed) && !activeLayer(ed)!.mask }),
    c("layer.mask.delete", "Delete", "Layer/Layer Mask", (ed) => ed.change("Delete Layer Mask", (d) => { const l = d.active; if (l) delete l.mask; }), { enabled: (ed) => !!activeLayer(ed)?.mask }),
    c("layer.mask.toggle", "Disable", "Layer/Layer Mask", (ed) => ed.change("Disable Layer Mask", (d) => { const l = d.active; if (l?.mask) l.mask.enabled = !l.mask.enabled; }), { enabled: (ed) => !!activeLayer(ed)?.mask, checked: (ed) => !!activeLayer(ed)?.mask && !activeLayer(ed)!.mask!.enabled }),
    c("layer.vmask.reveal", "Reveal All", "Layer/Vector Mask", (ed) => ed.change("Add Vector Mask", (d) => { const l = d.active; if (l) l.vectorMask = { path: { subpaths: [] }, enabled: true, linked: true, density: 1, feather: 0 }; })),
    c("layer.vmask.path", "Current Path", "Layer/Vector Mask", (ed) => ed.change("Add Vector Mask", (d) => { const l = d.active, p = d.paths[d.paths.length - 1]; if (l && p) l.vectorMask = { path: p.path, enabled: true, linked: true, density: 1, feather: 0 }; }), { enabled: (ed) => !!ed.doc?.paths.length }),
    c("layer.clip", "Create Clipping Mask", "Layer", (ed) => ed.change("Clipping Mask", (d) => { for (const id of d.selected) { const l = d.find(id); if (l) l.clip = !l.clip; } }), { key: "alt+mod+g", checked: (ed) => !!activeLayer(ed)?.clip }),
    c("layer.smart.convert", "Convert to Smart Object", "Layer/Smart Objects", (ed) => ed.run("smart.convert")),
    c("layer.smart.edit", "Edit Contents", "Layer/Smart Objects", (ed) => ed.run("smart.edit"), { enabled: (ed) => activeLayer(ed)?.kind === "smart" }),
    c("layer.rasterize", "Layer", "Layer/Rasterize", (ed) => ed.run("layer.rasterizeNow"), { enabled: (ed) => { const k = activeLayer(ed)?.kind; return k === "text" || k === "shape" || k === "smart" || k === "fill"; } }),
    c("layer.arrange.front", "Bring to Front", "Layer/Arrange", (ed) => ed.change("Bring to Front", (d) => d.activeId && d.arrange(d.activeId, "top")), { key: "shift+mod+]" }),
    c("layer.arrange.forward", "Bring Forward", "Layer/Arrange", (ed) => ed.change("Bring Forward", (d) => d.activeId && d.arrange(d.activeId, "up")), { key: "mod+]" }),
    c("layer.arrange.backward", "Send Backward", "Layer/Arrange", (ed) => ed.change("Send Backward", (d) => d.activeId && d.arrange(d.activeId, "down")), { key: "mod+[" }),
    c("layer.arrange.back", "Send to Back", "Layer/Arrange", (ed) => ed.change("Send to Back", (d) => d.activeId && d.arrange(d.activeId, "bottom")), { key: "shift+mod+[" }),
    c("layer.align", "Align…", "Layer/Align", (ed, how) => ed.run("move.align", how), { hidden: true }),
    c("layer.lock", "Lock Layers…", "Layer", (ed) => ed.change("Lock", (d) => { for (const id of d.selected) { const l = d.find(id); if (l) { const all = l.locks.pixels && l.locks.position && l.locks.transparency; l.locks = { ...l.locks, pixels: !all, position: !all, transparency: !all }; } } }), { key: "mod+/" }),
    c("layer.mergeDown", "Merge Down", "Layer", (ed) => ed.run("layer.merge", "down"), { key: "mod+e" }),
    c("layer.mergeVisible", "Merge Visible", "Layer", (ed) => ed.run("layer.merge", "visible"), { key: "shift+mod+e" }),
    c("layer.stampVisible", "Stamp Visible", "Layer", (ed) => ed.run("layer.merge", "stamp"), { key: "alt+shift+mod+e", hidden: true }),
    c("layer.flatten", "Flatten Image", "Layer", (ed) => ed.run("layer.merge", "flatten")),
    c("layer.hide", "Hide Layers", "Layer", (ed) => ed.change("Hide", (d) => { for (const id of d.selected) { const l = d.find(id); if (l) l.visible = !l.visible; } }), { key: "mod+,", hidden: true }),
    ...BLEND_MODES.map((m) => c(`layer.blend.${m}`, m, "", (ed) => ed.change("Blending Change", (d) => { for (const id of d.selected) { const l = d.find(id); if (l) l.blend = m; } }), { hidden: true })),

    // ——— Select
    c("select.all", "All", "Select", (ed) => ed.change("Select All", (d) => select.selectAll(d)), { key: "mod+a" }),
    c("select.none", "Deselect", "Select", (ed) => ed.change("Deselect", (d) => select.deselect(d)), { key: "mod+d", enabled: hasSel }),
    c("select.reselect", "Reselect", "Select", (ed) => ed.change("Reselect", (d) => select.reselect(d)), { key: "shift+mod+d" }),
    c("select.inverse", "Inverse", "Select", (ed) => ed.change("Inverse", (d) => select.invert(d)), { key: "shift+mod+i", sep: true }),
    c("select.allLayers", "All Layers", "Select", (ed) => ed.change("Select All Layers", (d) => { d.selected = d.all().map((l) => l.id); }), { key: "alt+mod+a" }),
    c("select.noLayers", "Deselect Layers", "Select", (ed) => ed.change("Deselect Layers", (d) => { d.selected = []; })),
    c("select.findLayers", "Find Layers", "Select", (ed) => ui(ed, "findLayers"), { key: "alt+shift+mod+f", sep: true }),
    c("select.colorRange", "Color Range…", "Select", (ed) => ui(ed, "colorRange")),
    c("select.focusArea", "Focus Area…", "Select", (ed) => ed.run("select.focus")),
    c("select.subject", "Subject", "Select", (ed) => ed.run("select.subjectNow")),
    c("select.sky", "Sky", "Select", (ed) => ed.run("select.skyNow")),
    c("select.mask", "Select and Mask…", "Select", (ed) => ui(ed, "selectAndMask"), { key: "alt+mod+r", sep: true }),
    c("select.border", "Border…", "Select/Modify", (ed) => ui(ed, "modify", "border"), { enabled: hasSel }),
    c("select.smooth", "Smooth…", "Select/Modify", (ed) => ui(ed, "modify", "smooth"), { enabled: hasSel }),
    c("select.expand", "Expand…", "Select/Modify", (ed) => ui(ed, "modify", "expand"), { enabled: hasSel }),
    c("select.contract", "Contract…", "Select/Modify", (ed) => ui(ed, "modify", "contract"), { enabled: hasSel }),
    c("select.feather", "Feather…", "Select/Modify", (ed) => ui(ed, "modify", "feather"), { key: "shift+f6", enabled: hasSel }),
    c("select.grow", "Grow", "Select", (ed) => ed.change("Grow", (d) => select.growSimilar(d, 32, true)), { enabled: hasSel }),
    c("select.similar", "Similar", "Select", (ed) => ed.change("Similar", (d) => select.growSimilar(d, 32, false)), { enabled: hasSel }),
    c("select.transform", "Transform Selection", "Select", (ed) => ed.run("select.transformSel"), { enabled: hasSel, sep: true }),
    c("select.quickMask", "Edit in Quick Mask Mode", "Select", (ed) => { ed.quickMask.set(!untrack(ed.quickMask)); ed.entry()?.doc.invalidate(null, false, true); }, { key: "q", checked: (ed) => untrack(ed.quickMask), sep: true }),
    c("select.load", "Load Selection…", "Select", (ed) => ui(ed, "loadSelection")),
    c("select.save", "Save Selection…", "Select", (ed) => ed.change("Save Selection", (d) => select.saveToChannel(d)), { enabled: hasSel }),

    // ——— View
    c("view.proof", "Proof Colors", "View", (ed) => setView(ed, { proof: !flag(ed, "proof") }), { key: "mod+y", checked: (ed) => flag(ed, "proof") }),
    c("view.gamut", "Gamut Warning", "View", (ed) => setView(ed, { gamut: !flag(ed, "gamut") }), { key: "shift+mod+y", checked: (ed) => flag(ed, "gamut"), sep: true }),
    c("view.zoomIn", "Zoom In", "View", (ed) => view(ed)?.zoomBy(1), { key: "mod+=" }),
    c("view.zoomOut", "Zoom Out", "View", (ed) => view(ed)?.zoomBy(-1), { key: "mod+-" }),
    c("view.fit", "Fit on Screen", "View", (ed) => view(ed)?.fit(), { key: "mod+0" }),
    c("view.fill", "Fill Screen", "View", (ed) => view(ed)?.fit(true)),
    c("view.actual", "100%", "View", (ed) => view(ed)?.actual(), { key: "mod+1" }),
    c("view.resetRotation", "Reset Rotation", "View", (ed) => setView(ed, { angle: 0 }), { sep: true }),
    c("view.screen.standard", "Standard Screen Mode", "View/Screen Mode", (ed) => ed.screenMode.set("standard"), { checked: (ed) => untrack(ed.screenMode) === "standard", enabled: undefined }),
    c("view.screen.menu", "Full Screen Mode With Menu Bar", "View/Screen Mode", (ed) => ed.screenMode.set("full-menu"), { checked: (ed) => untrack(ed.screenMode) === "full-menu", enabled: undefined }),
    c("view.screen.full", "Full Screen Mode", "View/Screen Mode", (ed) => ed.screenMode.set("full"), { checked: (ed) => untrack(ed.screenMode) === "full", enabled: undefined }),
    c("view.screen.cycle", "Cycle Screen Mode", "View/Screen Mode", (ed) => { const order = ["standard", "full-menu", "full"] as const; ed.screenMode.set(order[(order.indexOf(untrack(ed.screenMode)) + 1) % 3]!); }, { key: "f", hidden: true, enabled: undefined }),
    c("view.presentation", "Presentation", "View/Screen Mode", (ed) => ui(ed, "presentation"), { sep: true }),
    c("view.extras", "Extras", "View", (ed) => setView(ed, { extras: !flag(ed, "extras") }), { key: "mod+h", checked: (ed) => flag(ed, "extras") }),
    c("view.edges", "Selection Edges", "View/Show", (ed) => setView(ed, { edges: !flag(ed, "edges") }), { checked: (ed) => flag(ed, "edges") }),
    c("view.grid", "Grid", "View/Show", (ed) => setView(ed, { grid: !flag(ed, "grid") }), { key: "mod+'", checked: (ed) => flag(ed, "grid") }),
    c("view.guides", "Guides", "View/Show", (ed) => setView(ed, { guides: !flag(ed, "guides") }), { key: "mod+;", checked: (ed) => flag(ed, "guides") }),
    c("view.smartGuides", "Smart Guides", "View/Show", (ed) => setView(ed, { smartGuides: !flag(ed, "smartGuides") }), { checked: (ed) => flag(ed, "smartGuides") }),
    c("view.pixelGrid", "Pixel Grid", "View/Show", (ed) => setView(ed, { pixelGrid: !flag(ed, "pixelGrid") }), { checked: (ed) => flag(ed, "pixelGrid") }),
    c("view.rulers", "Rulers", "View", (ed) => setView(ed, { rulers: !flag(ed, "rulers") }), { key: "mod+r", checked: (ed) => flag(ed, "rulers") }),
    c("view.snap", "Snap", "View", (ed) => setView(ed, { snap: !flag(ed, "snap") }), { key: "shift+mod+;", checked: (ed) => flag(ed, "snap"), sep: true }),
    c("view.lockGuides", "Lock Guides", "View/Guides", (ed) => ed.change("Lock Guides", (d) => { d.guides = d.guides.map((g) => ({ ...g, locked: !g.locked })); })),
    c("view.clearGuides", "Clear Guides", "View/Guides", (ed) => ed.change("Clear Guides", (d) => { d.guides = []; })),
    c("view.newGuide", "New Guide…", "View/Guides", (ed) => ui(ed, "newGuide")),
    c("view.newGuideLayout", "New Guide Layout…", "View/Guides", (ed) => ui(ed, "guideLayout")),
    c("view.guidesFromShape", "New Guides From Shape", "View/Guides", (ed) => ed.change("New Guides From Shape", (d) => {
      const l = d.active, b = l && hasRaster(l) ? l.raster.bounds() : null;
      if (!b) return;
      const id = (): string => `g${Math.random().toString(36).slice(2, 9)}`;
      d.guides = [...d.guides, { id: id(), axis: "x", pos: b.x }, { id: id(), axis: "x", pos: b.x + b.w / 2 }, { id: id(), axis: "x", pos: b.x + b.w }, { id: id(), axis: "y", pos: b.y }, { id: id(), axis: "y", pos: b.y + b.h / 2 }, { id: id(), axis: "y", pos: b.y + b.h }];
    })),
    c("view.clearSlices", "Clear Slices", "View", (ed) => ed.change("Clear Slices", (d) => { d.slices = []; })),

    // ——— Window
    c("window.workspace.essentials", "Essentials", "Window/Workspace", (ed) => ed.workspace.set("essentials"), { checked: (ed) => untrack(ed.workspace) === "essentials", enabled: undefined }),
    c("window.workspace.photography", "Photography", "Window/Workspace", (ed) => ed.workspace.set("photography"), { checked: (ed) => untrack(ed.workspace) === "photography", enabled: undefined }),
    c("window.workspace.painting", "Painting", "Window/Workspace", (ed) => ed.workspace.set("painting"), { checked: (ed) => untrack(ed.workspace) === "painting", enabled: undefined }),
    c("window.workspace.design", "Design", "Window/Workspace", (ed) => ed.workspace.set("design"), { checked: (ed) => untrack(ed.workspace) === "design", enabled: undefined, sep: true }),
    c("window.resetWorkspace", "Reset Workspace", "Window/Workspace", (ed) => ui(ed, "resetWorkspace"), { enabled: undefined }),
    c("window.float", "Float in Window", "Window/Arrange", (ed) => { const e = ed.entry(); if (e) e.floating.set(!untrack(e.floating)); }, { checked: (ed) => !!ed.entry() && untrack(ed.entry()!.floating) }),
    c("window.consolidate", "Consolidate All to Tabs", "Window/Arrange", (ed) => { for (const e of untrack(ed.docs)) e.floating.set(false); }),
    c("window.tabHide", "Show / Hide Panels", "Window", (ed) => ed.uiHidden.set(!untrack(ed.uiHidden)), { key: "tab", hidden: true, enabled: undefined }),

    // ——— Help
    c("help.palette", "Search Commands…", "Help", (ed) => ui(ed, "palette"), { key: "mod+f", enabled: undefined }),
    c("help.shortcuts", "Keyboard Shortcuts", "Help", (ed) => ui(ed, "shortcuts"), { enabled: undefined }),
    c("help.about", "About Photo Editor", "Help", (ed) => ui(ed, "about"), { enabled: undefined }),

    // ——— colors and tools (keys only)
    c("color.swap", "Swap Colors", "", (ed) => ed.swapColors(), { key: "x", hidden: true, enabled: undefined }),
    c("color.reset", "Default Colors", "", (ed) => ed.resetColors(), { key: "d", hidden: true, enabled: undefined }),
    c("brush.smaller", "Decrease Brush Size", "", (ed) => { const s = ed.options().size; if (typeof s === "number") ed.setOption("size", Math.max(1, Math.round(s / 1.15))); }, { key: "[", hidden: true, enabled: undefined }),
    c("brush.larger", "Increase Brush Size", "", (ed) => { const s = ed.options().size; if (typeof s === "number") ed.setOption("size", Math.min(5000, Math.round(s * 1.15 + 1))); }, { key: "]", hidden: true, enabled: undefined }),
    c("brush.softer", "Decrease Hardness", "", (ed) => { const s = ed.options().hardness; if (typeof s === "number") ed.setOption("hardness", Math.max(0, s - 0.25)); }, { key: "shift+[", hidden: true, enabled: undefined }),
    c("brush.harder", "Increase Hardness", "", (ed) => { const s = ed.options().hardness; if (typeof s === "number") ed.setOption("hardness", Math.min(1, s + 0.25)); }, { key: "shift+]", hidden: true, enabled: undefined }),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => c(`tool.opacity.${n}`, `Opacity ${n === 0 ? 100 : n * 10} %`, "", (ed) => {
      const o = ed.options(), v = n === 0 ? 1 : n / 10;
      if ("opacity" in o) ed.setOption("opacity", v);
      else { const d = ed.doc; if (d) d.change("Opacity", () => { for (const id of d.selected) { const l = d.find(id); if (l) l.opacity = v; } }); }
    }, { key: String(n), hidden: true })),
  ];
}

function maskFull(d: ImageDocument, v: number): Mask {
  const m = new Mask(d.width, d.height, v);
  m.outside = v;
  return m;
}

const structuredCloneSafe = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Merge layers: down, visible, stamp visible, flatten. */
export function mergeCommand(): EditorCommand {
  return {
    id: "layer.merge", label: "Merge", hidden: true,
    run: (ed, how) => {
      const d = ed.doc;
      if (!d) return;
      d.change(how === "flatten" ? "Flatten Image" : how === "visible" ? "Merge Visible" : how === "stamp" ? "Stamp Visible" : "Merge Down", () => {
        const straight = (px: Float32Array): Float32Array => { for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i]! /= a; px[i + 1]! /= a; px[i + 2]! /= a; } } return px; };
        if (how === "down") {
          const loc = d.activeId ? d.locate(d.activeId) : null;
          if (!loc || loc.index === 0) return;
          const top = loc.list[loc.index]!, below = loc.list[loc.index - 1]!;
          if (!hasRaster(below)) return;
          const keep = d.layers;
          // render the two alone, in place
          d.layers = [{ ...below, visible: true }, { ...top, visible: true }];
          const px = straight(renderRegion(d, d.bounds));
          d.layers = keep;
          const merged = d.newPixelLayer(below.name);
          merged.raster.write(0, 0, d.width, d.height, px);
          loc.list.splice(loc.index - 1, 2, merged);
          d.activeId = merged.id; d.selected = [merged.id];
          return;
        }
        const px = straight(renderRegion(d, d.bounds));
        const l = d.newPixelLayer(how === "flatten" ? "Background" : how === "stamp" ? d.nextName() : "Merged");
        l.raster.write(0, 0, d.width, d.height, px);
        if (how === "flatten") { l.data = { background: true }; l.locks.position = true; d.layers = [l]; }
        else if (how === "visible") { d.layers = [...d.layers.filter((x) => !x.visible), l]; }
        else d.add(l);
        d.activeId = l.id; d.selected = [l.id];
      });
    },
  };
}

/** The menu bar: menus in order, items from the commands by their menu path. */
export const MENU_ORDER = ["File", "Edit", "Image", "Layer", "Type", "Select", "Filter", "3D", "View", "Plugins", "Window", "Help"].filter((m) => m !== "3D");

export type MenuNode = { label: string; items: (MenuNode | EditorCommand | "-")[] };

/** Build the menu tree from the commands (paths like "Image/Adjustments"). */
export function menuTree(cmds: Iterable<EditorCommand>): MenuNode[] {
  const roots = new Map<string, MenuNode>(MENU_ORDER.map((m) => [m, { label: m, items: [] }]));
  for (const cmd of cmds) {
    if (!cmd.menu || cmd.hidden) continue;
    const [top, ...rest] = cmd.menu.split("/");
    let node = roots.get(top!);
    if (!node) { node = { label: top!, items: [] }; roots.set(top!, node); }
    for (const part of rest) {
      let sub = node.items.find((x): x is MenuNode => typeof x === "object" && "items" in x && x.label === part);
      if (!sub) { sub = { label: part, items: [] }; node.items.push(sub); }
      node = sub;
    }
    node.items.push(cmd);
    if (cmd.sep) node.items.push("-");
  }
  return [...roots.values()].filter((n) => n.items.length);
}

/** Copy pixel / layer helpers used by the panels. */
export const copyLayer = deepCopyLayer;
export type { RGBA };
