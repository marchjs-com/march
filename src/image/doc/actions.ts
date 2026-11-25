// Actions: recorded macros. Commands (id, label, run) live in a registry; runCommand() runs one as an undo step and,
// while recording, appends it to the action being recorded. Tool strokes are recorded as { tool, options, points } and
// replayed with drag(). Action sets (folders), steps switched on / off, modal steps (a dialog callback can change the
// arguments or cancel), stops with a message, playing from a step, batch over files with injected open / save, and a
// JSON export / import of action sets (droplet-like). Built-in example actions use registered commands and op ids.

import type { ImageDocument } from "./document.ts";
import { newId, type Layer, type RGBA } from "./layers.ts";
import { drag, getTool, headlessContext, type ToolContext } from "./tools/tool.ts";
import { renderPaint } from "./paint.ts";
import { textData } from "./text-model.ts";
import { resampleRGBA } from "./export/index.ts";
import { hasRaster, walk } from "./layers.ts";
import { Mask } from "./tiles.ts";

export interface Command {
  id: string;
  /** English label (translated by the UI); also the undo step's name. */
  label: string;
  /** Change the document (runs inside one doc.change step). */
  run(doc: ImageDocument, args: Record<string, unknown>): void;
  /** True when the command normally shows a dialog (its step can be made modal). */
  dialog?: boolean | undefined;
}

const commands = new Map<string, Command>();

/** Add commands (built-ins and plugins). Returns a remover. */
export function registerCommand(...cmds: Command[]): () => void {
  for (const c of cmds) commands.set(c.id, c);
  return () => { for (const c of cmds) if (commands.get(c.id) === c) commands.delete(c.id); };
}
export const getCommand = (id: string): Command | undefined => commands.get(id);
export const allCommands = (): Command[] => [...commands.values()];

// ——— action model ———

export type ActionStep =
  | { id: string; kind: "command"; command: string; args: Record<string, unknown>; enabled: boolean; modal?: boolean | undefined; label?: string | undefined }
  | { id: string; kind: "stroke"; tool: string; options: Record<string, unknown>; points: [number, number][]; fg?: RGBA | undefined; bg?: RGBA | undefined; enabled: boolean; label?: string | undefined }
  | { id: string; kind: "stop"; message: string; allowContinue: boolean; enabled: boolean };

export interface Action { id: string; name: string; steps: ActionStep[]; /** Function key shortcut (F2…). */ key?: string | undefined; color?: string | undefined }
export interface ActionSet { id: string; name: string; actions: Action[] }

export const newAction = (name: string, steps: ActionStep[] = []): Action => ({ id: newId("a"), name, steps });
export const newActionSet = (name: string, actions: Action[] = []): ActionSet => ({ id: newId("as"), name, actions });
export const commandStep = (command: string, args: Record<string, unknown> = {}, extra: Partial<{ modal: boolean; enabled: boolean; label: string }> = {}): ActionStep =>
  ({ id: newId("st"), kind: "command", command, args, enabled: extra.enabled ?? true, ...(extra.modal ? { modal: true } : {}), ...(extra.label ? { label: extra.label } : {}) });
export const stopStep = (message: string, allowContinue = true): ActionStep => ({ id: newId("st"), kind: "stop", message, allowContinue, enabled: true });

/** A short description of a step (the Actions panel line). */
export function stepLabel(s: ActionStep): string {
  if (s.kind === "stop") return `Stop: ${s.message}`;
  if (s.kind === "stroke") return s.label ?? `${getTool(s.tool)?.label ?? s.tool} stroke`;
  return s.label ?? getCommand(s.command)?.label ?? s.command;
}

// ——— recording ———

let recording: Action | null = null;

/** Start recording into an action (steps are appended). */
export function startRecording(action: Action): void { recording = action; }
/** Stop recording; returns the action. */
export function stopRecording(): Action | null { const a = recording; recording = null; return a; }
export const isRecording = (): boolean => !!recording;

/** Run a command as one undo step (recorded while recording). */
export function runCommand(doc: ImageDocument, id: string, args: Record<string, unknown> = {}): void {
  const cmd = commands.get(id);
  if (!cmd) throw new Error(`Unknown command "${id}"`);
  doc.change(cmd.label, () => cmd.run(doc, args), `command:${id}`);
  if (recording) recording.steps.push(commandStep(id, structuredClone(args)));
}

/** Record a finished tool stroke (the UI calls this after a drag while recording). */
export function recordStroke(tool: string, options: Record<string, unknown>, points: [number, number][], colors: { fg?: RGBA; bg?: RGBA } = {}): void {
  if (!recording) return;
  const s: ActionStep = { id: newId("st"), kind: "stroke", tool, options: structuredClone(options), points: points.map(([x, y]) => [x, y]), enabled: true };
  if (colors.fg) s.fg = [...colors.fg];
  if (colors.bg) s.bg = [...colors.bg];
  recording.steps.push(s);
}

/** Run a tool stroke now and record it (scripts, tests). */
export function runStroke(doc: ImageDocument, tool: string, options: Record<string, unknown>, points: [number, number][], ctx: Partial<ToolContext> = {}): void {
  const t = getTool(tool);
  if (!t) throw new Error(`Unknown tool "${tool}"`);
  const c = headlessContext(doc, options, ctx);
  drag(t, c, points);
  recordStroke(tool, options, points, { fg: c.fg, bg: c.bg });
}

// ——— playback ———

export interface PlayOptions {
  /** Start at this step index. */
  from?: number | undefined;
  /** Only this one step (Play step). */
  only?: boolean | undefined;
  /** Modal steps: show the dialog; resolve new args, or null to cancel the action. */
  modal?: ((step: ActionStep & { kind: "command" }, cmd: Command) => Promise<Record<string, unknown> | null>) | undefined;
  /** Stop steps: show the message; resolve true to continue (only offered when allowContinue). */
  stop?: ((message: string, allowContinue: boolean) => Promise<boolean>) | undefined;
  /** Context for tool strokes (shared state, colors). */
  ctx?: Partial<ToolContext> | undefined;
  /** Progress per step. */
  onStep?: ((index: number, step: ActionStep) => void) | undefined;
}
export interface PlayResult { completed: boolean; stoppedAt?: number | undefined; message?: string | undefined }

/** Play an action on a document. Each step is its own undo step, like recorded commands. */
export async function play(doc: ImageDocument, action: Action, o: PlayOptions = {}): Promise<PlayResult> {
  const start = o.from ?? 0;
  const end = o.only ? start + 1 : action.steps.length;
  for (let i = start; i < end; i++) {
    const s = action.steps[i];
    if (!s || !s.enabled) continue;
    o.onStep?.(i, s);
    if (s.kind === "stop") {
      const go = o.stop ? await o.stop(s.message, s.allowContinue) : false;
      if (!go || !s.allowContinue) return { completed: false, stoppedAt: i, message: s.message };
      continue;
    }
    if (s.kind === "stroke") {
      const t = getTool(s.tool);
      if (!t) throw new Error(`Action "${action.name}": unknown tool "${s.tool}"`);
      const extra: Partial<ToolContext> = { ...(o.ctx ?? {}) };
      if (s.fg) extra.fg = [...s.fg];
      if (s.bg) extra.bg = [...s.bg];
      drag(t, headlessContext(doc, { ...s.options }, extra), s.points);
      continue;
    }
    const cmd = commands.get(s.command);
    if (!cmd) throw new Error(`Action "${action.name}": unknown command "${s.command}"`);
    let args = s.args;
    if (s.modal && o.modal) {
      const r = await o.modal(s, cmd);
      if (!r) return { completed: false, stoppedAt: i, message: "cancelled" };
      args = r;
    }
    doc.change(cmd.label, () => cmd.run(doc, structuredClone(args)), `command:${cmd.id}`);
  }
  return { completed: true };
}

export interface BatchOptions<F> {
  open: (file: F) => Promise<ImageDocument>;
  save: (doc: ImageDocument, file: F, index: number) => Promise<void>;
  /** Keep going after a failing file (default true); errors are collected. */
  continueOnError?: boolean | undefined;
  play?: PlayOptions | undefined;
  onProgress?: ((done: number, total: number, file: F) => void) | undefined;
}

/** Run an action over many files (File › Automate › Batch). */
export async function batch<F>(files: F[], action: Action, o: BatchOptions<F>): Promise<{ done: number; errors: { file: F; error: unknown }[] }> {
  const errors: { file: F; error: unknown }[] = [];
  let done = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    try {
      const doc = await o.open(f);
      const r = await play(doc, action, o.play ?? {});
      if (!r.completed) throw new Error(r.message ?? "stopped");
      await o.save(doc, f, i);
      done++;
    } catch (error) {
      errors.push({ file: f, error });
      if (o.continueOnError === false) break;
    }
    o.onProgress?.(i + 1, files.length, f);
  }
  return { done, errors };
}

// ——— JSON ———

export const ACTIONS_FORMAT = "march-actions";

/** Action sets as a JSON file (share, back up, droplets). */
export function exportActionSets(sets: ActionSet[]): string {
  return JSON.stringify({ format: ACTIONS_FORMAT, version: 1, sets }, null, 2);
}

/** Read action sets from JSON; ids are renewed so imports never collide. */
export function importActionSets(json: string): ActionSet[] {
  const data = JSON.parse(json) as { format?: string; version?: number; sets?: unknown };
  if (data.format !== ACTIONS_FORMAT || !Array.isArray(data.sets)) throw new Error("Not a March actions file");
  if ((data.version ?? 1) > 1) throw new Error(`Actions file version ${data.version} is newer than this reader`);
  return (data.sets as ActionSet[]).map((s) => {
    if (typeof s?.name !== "string" || !Array.isArray(s.actions)) throw new Error("Malformed action set");
    return {
      id: newId("as"), name: s.name,
      actions: s.actions.map((a) => ({
        ...a, id: newId("a"),
        steps: (a.steps ?? []).map((st) => {
          if (st.kind !== "command" && st.kind !== "stroke" && st.kind !== "stop") throw new Error(`Unknown step kind ${(st as { kind?: string }).kind}`);
          return { ...st, id: newId("st"), enabled: st.enabled !== false } as ActionStep;
        }),
      })),
    };
  });
}

// ——— built-in commands ———

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const rgba = (v: unknown, d: RGBA): RGBA => (Array.isArray(v) && v.length >= 3 ? [num(v[0], 0), num(v[1], 0), num(v[2], 0), num(v[3], 1)] : d);

/** Commands every editor has; actions and scripts use them by id. */
export const BUILTIN_COMMANDS: Command[] = [
  {
    id: "layer.new", label: "New Layer",
    run: (doc, a) => { const l = doc.newPixelLayer(typeof a.name === "string" ? a.name : doc.nextName()); doc.add(l); },
  },
  {
    id: "layer.fill", label: "Fill",
    run: (doc, a) => {
      const l = doc.active;
      if (!l || !hasRaster(l)) return;
      const r = doc.selection?.bounds() ?? doc.bounds;
      const paint = (a.paint as never) ?? { type: "solid", color: rgba(a.color, [0, 0, 0, 1]) };
      const px = renderPaint(paint, r, undefined, doc.bounds);
      if (doc.selection) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) px[(y * r.w + x) * 4 + 3]! *= doc.selection.get(r.x + x, r.y + y) / 255;
      const under = l.raster.read(r.x, r.y, r.w, r.h);
      for (let i = 0; i < px.length; i += 4) {
        const sa = px[i + 3]!, da = under[i + 3]!, oa = sa + da * (1 - sa);
        for (let c = 0; c < 3; c++) under[i + c] = oa ? (px[i + c]! * sa + under[i + c]! * da * (1 - sa)) / oa : 0;
        under[i + 3] = oa;
      }
      l.raster.write(r.x, r.y, r.w, r.h, under);
    },
  },
  {
    id: "layer.set", label: "Layer Properties",
    run: (doc, a) => { const l = doc.active; if (!l) return; const patch: Partial<Layer> = {}; for (const k of ["opacity", "fill", "blend", "visible", "name", "clip"] as const) if (k in a) (patch as Record<string, unknown>)[k] = a[k]; doc.set(l.id, patch); },
  },
  {
    id: "adjust.add", label: "New Adjustment Layer", dialog: true,
    run: (doc, a) => { const id = String(a.op ?? "levels"); doc.add(doc.newAdjustment(id, (a.params as Record<string, unknown>) ?? {}, typeof a.name === "string" ? a.name : id)); },
  },
  {
    id: "fill.add", label: "New Fill Layer", dialog: true,
    run: (doc, a) => {
      const l = doc.newFillLayer((a.paint as never) ?? { type: "solid", color: rgba(a.color, [0, 0, 0, 1]) }, typeof a.name === "string" ? a.name : "Fill");
      if (typeof a.blend === "string") l.blend = a.blend as never;
      if (typeof a.opacity === "number") l.opacity = a.opacity;
      doc.add(l);
    },
  },
  {
    id: "text.add", label: "Add Text",
    run: (doc, a) => {
      const size = num(a.size, Math.max(12, Math.round(doc.height / 24)));
      const where = String(a.position ?? "bottom-right"), m = num(a.margin, size);
      const x = where.endsWith("left") ? m : where.endsWith("center") ? doc.width / 2 : doc.width - m;
      const y = where.startsWith("top") ? m + size : where.startsWith("middle") ? doc.height / 2 : doc.height - m;
      const t = textData(String(a.text ?? "Text"), { type: "point", x, y }, { size, color: rgba(a.color, [1, 1, 1, 1]), ...(typeof a.font === "string" ? { font: a.font } : {}) }, { align: where.endsWith("left") ? "left" : where.endsWith("center") ? "center" : "right" });
      const l = doc.newText(t, String(a.text ?? "Text").slice(0, 40));
      l.opacity = num(a.opacity, 1);
      doc.add(l);
    },
  },
  {
    id: "image.resize", label: "Image Size", dialog: true,
    // fallback until march/image lands: box / bilinear resampling of every layer, masks and channels nearest
    run: (doc, a) => {
      let w = Math.round(num(a.width, doc.width)), h = Math.round(num(a.height, doc.height));
      const max = num(a.maxSide, 0);
      if (max && Math.max(doc.width, doc.height) > max) { const k = max / Math.max(doc.width, doc.height); w = Math.round(doc.width * k); h = Math.round(doc.height * k); }
      else if (max) return;
      if (a.width != null && a.height == null) h = Math.round((doc.height * w) / doc.width);
      if (a.height != null && a.width == null) w = Math.round((doc.width * h) / doc.height);
      if (w === doc.width && h === doc.height) return;
      const sx = w / doc.width, sy = h / doc.height;
      for (const [l] of walk(doc.layers)) {
        if (hasRaster(l)) {
          const b = l.raster.bounds();
          if (b) {
            const px = l.raster.read(b.x, b.y, b.w, b.h);
            for (let i = 0; i < px.length; i += 4) { const al = px[i + 3]!; px[i]! *= al; px[i + 1]! *= al; px[i + 2]! *= al; }
            const nx = Math.round(b.x * sx), ny = Math.round(b.y * sy), nw = Math.max(1, Math.round(b.w * sx)), nh = Math.max(1, Math.round(b.h * sy));
            const out = resampleRGBA(px, b.w, b.h, nw, nh);
            for (let i = 0; i < out.length; i += 4) { const al = out[i + 3]!; if (al > 0) { out[i]! /= al; out[i + 1]! /= al; out[i + 2]! /= al; } }
            l.raster.clear(); l.raster.ox = 0; l.raster.oy = 0;
            l.raster.write(nx, ny, nw, nh, out);
          }
        }
        if (l.mask) l.mask.mask = scaleMask(l.mask.mask, w, h);
        if (l.kind === "artboard") l.rect = { x: Math.round(l.rect.x * sx), y: Math.round(l.rect.y * sy), w: Math.round(l.rect.w * sx), h: Math.round(l.rect.h * sy) };
      }
      for (const c of doc.channels) c.mask = scaleMask(c.mask, w, h);
      if (doc.selection) doc.selection = scaleMask(doc.selection, w, h);
      doc.width = w; doc.height = h;
    },
  },
];

function scaleMask(m: Mask, w: number, h: number): Mask {
  const n = new Mask(w, h);
  n.outside = m.outside;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n.data[y * w + x] = m.get(Math.floor((x * m.width) / w), Math.floor((y * m.height) / h));
  return n;
}

registerCommand(...BUILTIN_COMMANDS);

/** Example actions (the "Default Actions" set): they show how steps use commands and op ids. */
export function builtinActions(): ActionSet {
  return newActionSet("Default Actions", [
    newAction("Vignette", [
      commandStep("fill.add", { name: "Vignette", blend: "multiply", opacity: 0.6, paint: { type: "gradient", gradient: { type: "radial", relative: true, from: [0.5, 0.5], to: [1.1, 0.5], stops: [{ at: 0, color: [1, 1, 1, 0] }, { at: 0.55, color: [1, 1, 1, 0] }, { at: 1, color: [0, 0, 0, 1] }] } } }),
    ]),
    newAction("Sepia Tone", [
      commandStep("adjust.add", { op: "blackWhite", name: "Sepia: black & white", params: {} }),
      commandStep("adjust.add", { op: "photoFilter", name: "Sepia: warm", params: { color: [0.67, 0.45, 0.24], density: 0.6, preserveLuminosity: true } }),
    ]),
    newAction("Resize for Web", [commandStep("image.resize", { maxSide: 1600 }, { modal: true })]),
    newAction("Watermark", [commandStep("text.add", { text: "© March", position: "bottom-right", opacity: 0.5, color: [1, 1, 1, 1] }, { modal: true })]),
  ]);
}
