// Collaboration for the PhotoEditor: live cursors (who is where, on which document), layer comments shared as they are
// written, and named versions (saved .march-image states you can open again). The transport is yours (a WebSocket,
// WebRTC, a server) — or `broadcastTransport()` between tabs of the same browser. People are reported to the
// Presence manager, so the rest of the app sees them too.
//   const stop = collaborate(editor, broadcastTransport("room-1"), { id: "u1", name: "Ada", color: "#ff7a1a" });

import { signal, untrack, type Signal } from "../../../core/reactive.ts";
import { presence } from "../../../managers/presence/index.ts";
import { saveDocument, loadDocument, newId, type LayerComment } from "../../../image/doc/index.ts";
import type { Editor } from "./editor.ts";

export interface Collaborator { id: string; name: string; color: string }
export interface PeerCursor extends Collaborator { doc: string; x: number; y: number; at: number; layer?: string | undefined; tool?: string | undefined }
export type CollabMessage =
  | { type: "hello"; from: Collaborator }
  | { type: "cursor"; from: Collaborator; doc: string; x: number; y: number; layer?: string | undefined; tool?: string | undefined }
  | { type: "comment"; from: Collaborator; doc: string; layer: string; comment: LayerComment }
  | { type: "resolve"; from: Collaborator; doc: string; layer: string; id: string }
  | { type: "bye"; from: Collaborator };

export interface CollabTransport {
  send(msg: CollabMessage): void;
  onMessage(fn: (msg: CollabMessage) => void): () => void;
  close?(): void;
}

/** A transport between tabs of the same browser (BroadcastChannel). */
export function broadcastTransport(room: string): CollabTransport {
  const BC = (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
  if (!BC) return { send: () => {}, onMessage: () => () => {} };
  const ch = new BC(`march.photo-editor.${room}`);
  return {
    send: (m) => ch.postMessage(m),
    onMessage: (fn) => { const h = (e: MessageEvent): void => fn(e.data as CollabMessage); ch.addEventListener("message", h); return () => ch.removeEventListener("message", h); },
    close: () => ch.close(),
  };
}

export interface Version { id: string; name: string; at: number; author: string; bytes: Uint8Array; doc: string }

export interface Collab {
  me: Collaborator;
  /** Other people's cursors (reactive). */
  cursors: Signal<PeerCursor[]>;
  /** Saved versions of the open documents (reactive). */
  versions: Signal<Version[]>;
  /** Add a comment to a layer of the active document (shared with everyone). */
  comment(layerId: string, text: string, at?: [number, number]): void;
  resolve(layerId: string, id: string): void;
  /** Keep the active document's state as a named version. */
  saveVersion(name: string): Promise<Version | null>;
  /** Open a version as a new tab. */
  openVersion(id: string): Promise<void>;
  stop(): void;
}

/** Start collaborating on an editor. */
export function collaborate(ed: Editor, transport: CollabTransport, me: Collaborator, o: { cursorEvery?: number; staleAfter?: number } = {}): Collab {
  const cursors = signal<PeerCursor[]>([]);
  const versions = signal<Version[]>([]);
  const every = o.cursorEvery ?? 50, stale = o.staleAfter ?? 15_000;
  let last = 0;
  const pres = presence();
  const docKey = (): string => ed.doc?.id ?? "";

  const offMsg = transport.onMessage((m) => {
    if (m.from.id === me.id) return;
    if (m.type === "hello") { transport.send({ type: "cursor", from: me, doc: docKey(), x: -1, y: -1 }); pres.setPeer(m.from.id, "active", { name: m.from.name, color: m.from.color }); return; }
    if (m.type === "bye") { cursors.set(untrack(cursors).filter((c) => c.id !== m.from.id)); pres.setPeer(m.from.id, "offline", { name: m.from.name }); return; }
    if (m.type === "cursor") {
      const next = untrack(cursors).filter((c) => c.id !== m.from.id && Date.now() - c.at < stale);
      next.push({ ...m.from, doc: m.doc, x: m.x, y: m.y, layer: m.layer, tool: m.tool, at: Date.now() });
      cursors.set(next);
      pres.setPeer(m.from.id, "active", { name: m.from.name, color: m.from.color });
      ed.entry()?.doc.invalidate(null, false, true);
      return;
    }
    const d = untrack(ed.docs).find((e) => e.doc.id === m.doc)?.doc;
    if (!d) return;
    if (m.type === "comment") d.change("Comment", () => { const l = d.find(m.layer); if (l) l.comments = [...(l.comments ?? []), m.comment]; });
    if (m.type === "resolve") d.change("Resolve Comment", () => { const l = d.find(m.layer); if (l) l.comments = (l.comments ?? []).map((c) => (c.id === m.id ? { ...c, resolved: true } : c)); });
  });

  // my cursor, throttled
  const offPointer = ed.on("doc:change", (data) => {
    const p = (data as { pointer?: [number, number] } | undefined)?.pointer;
    if (!p) return;
    const now = Date.now();
    if (now - last < every) return;
    last = now;
    transport.send({ type: "cursor", from: me, doc: docKey(), x: p[0], y: p[1], layer: ed.doc?.activeId ?? undefined, tool: untrack(ed.tool) });
  });
  transport.send({ type: "hello", from: me });
  ed.shared.collab = { cursors: () => cursors(), me };

  return {
    me, cursors, versions,
    comment: (layerId, text, at) => {
      const d = ed.doc;
      if (!d) return;
      const c: LayerComment = { id: newId("c"), author: me.name, text, at: Date.now(), ...(at ? { x: at[0], y: at[1] } : {}) };
      d.change("Comment", () => { const l = d.find(layerId); if (l) l.comments = [...(l.comments ?? []), c]; });
      transport.send({ type: "comment", from: me, doc: d.id, layer: layerId, comment: c });
    },
    resolve: (layerId, id) => {
      const d = ed.doc;
      if (!d) return;
      d.change("Resolve Comment", () => { const l = d.find(layerId); if (l) l.comments = (l.comments ?? []).map((c) => (c.id === id ? { ...c, resolved: true } : c)); });
      transport.send({ type: "resolve", from: me, doc: d.id, layer: layerId, id });
    },
    saveVersion: async (name) => {
      const d = ed.doc;
      if (!d) return null;
      const v: Version = { id: newId("v"), name, at: Date.now(), author: me.name, bytes: await saveDocument(d), doc: d.id };
      versions.set([v, ...untrack(versions)]);
      return v;
    },
    openVersion: async (id) => {
      const v = untrack(versions).find((x) => x.id === id);
      if (!v) return;
      const d = await loadDocument(v.bytes);
      d.name = `${d.name} — ${v.name}`;
      ed.addDoc(d);
    },
    stop: () => { transport.send({ type: "bye", from: me }); offMsg(); offPointer(); transport.close?.(); delete ed.shared.collab; },
  };
}
