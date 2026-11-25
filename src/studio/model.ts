// march/studio model: one project JSON for video and audio editing, and the edit operations on it. Every operation is
// a pure function (project in, new project out): undo keeps the old value, co-editing sends the operation's name and
// arguments, tests check plain data. Times are seconds on the timeline; a clip shows `in..out` of its source.
//
//   let p = emptyProject({ fps: 30 })
//   p = addTrack(p, { kind: "video" }); p = addClip(p, { track: p.tracks[0].id, start: 0, in: 0, out: 8, src: "a.mp4" })
//   p = split(p, p.clips[0].id, 3); p = trim(p, id, "end", 6, { ripple: true }); p = slip(p, id, 1.5)

/** Kind of a track: what its clips are and how they play. @tr İzin türü: kliplerinin ne olduğu ve nasıl oynadığı. */
export type TrackKind = "video" | "audio" | "text" | "effect" | "adjustment" | (string & {});
/** Shape of a fade or a crossfade. @tr Bir geçişin ya da çapraz geçişin eğrisi. */
export type FadeCurve = "linear" | "equal-power" | "log" | "exp" | "s-curve";

/** An effect applied to a clip, a track, a bus or the master: an id from the effect registry and its parameters. */
export interface EffectRef { id: string; params?: Record<string, unknown> | undefined; bypass?: boolean | undefined }
/** A fade at a clip's start or end: length in seconds and its curve. */
export interface Fade { length: number; curve?: FadeCurve | undefined }
/** A send from a track to a bus (reverb, delay return): level 0–1, before or after the fader. */
export interface Send { bus: string; level: number; pre?: boolean | undefined }

/** A piece of media placed on the timeline. */
export interface Clip {
  id: string;
  track: string;
  /** Where it starts on the timeline, s. */
  start: number;
  /** Source in and out points, s (the part of the source that plays). */
  in: number;
  out: number;
  /** Length of the whole source, s (limits trims and slips); unknown: no limit at the end. */
  sourceDuration?: number | undefined;
  src?: string | undefined;
  /** Proxy (small copy) used while editing; `src` is used on export. */
  proxy?: string | undefined;
  asset?: string | undefined;
  name?: string | undefined;
  color?: string | undefined;
  /** Playback speed (1 = normal); the clip lasts (out - in) / speed on the timeline. */
  speed?: number | undefined;
  /** Gain, linear (1 = as recorded). */
  gain?: number | undefined;
  fadeIn?: Fade | undefined;
  fadeOut?: Fade | undefined;
  /** Text of a text clip (titles, captions). */
  text?: string | undefined;
  /** Look of a text clip / transform of a visual clip (free JSON read by the renderer). */
  style?: Record<string, unknown> | undefined;
  effects?: EffectRef[] | undefined;
  /** Clips with the same link id move, cut and trim together (a video and its sound). */
  link?: string | undefined;
  muted?: boolean | undefined;
  /** Where the clip's frames and sound come from when it is not a plain `src`: a media id, a nested sequence, a generator (see registerSource in march/studio/render). */
  source?: ClipSource | undefined;
  /** How timeline time maps to source time: a name from registerTimeMap (default linear: in + (t - start) × speed). */
  timeMap?: string | undefined;
  /** Extensions, one namespace each (tracking paths, hotspots, angles, remap curves, grades…); the core keeps them as they are. */
  ext?: Record<string, unknown> | undefined;
}

/** A clip's source beyond `src`: an item of `project.media`, another sequence (nested), or a generator of a registered kind. */
export type ClipSource = { media: string } | { sequence: string } | { kind: string; [key: string]: unknown };
/** A media item of the project (the bin): its file, kind, length and optional proxy. */
export interface MediaRef { id: string; src: string; kind: "video" | "audio" | "image" | (string & {}); duration?: number | undefined; fps?: number | undefined; width?: number | undefined; height?: number | undefined; proxy?: string | undefined; name?: string | undefined; meta?: Record<string, unknown> | undefined }

/** A row of the timeline. */
export interface Track {
  id: string;
  kind: TrackKind;
  name?: string | undefined;
  muted?: boolean | undefined;
  solo?: boolean | undefined;
  locked?: boolean | undefined;
  hidden?: boolean | undefined;
  /** Fader gain, linear (1 = 0 dB). */
  volume?: number | undefined;
  /** Pan, -1 (left) … 1 (right). */
  pan?: number | undefined;
  /** Record-armed (the recording studio records into it). */
  armed?: boolean | undefined;
  height?: number | undefined;
  color?: string | undefined;
  effects?: EffectRef[] | undefined;
  sends?: Send[] | undefined;
  ext?: Record<string, unknown> | undefined;
}

/** A point (or a span) on the timeline: a marker, a chapter, a beat, a cue. */
export interface Marker { id: string; time: number; duration?: number | undefined; label?: string | undefined; color?: string | undefined; kind?: "marker" | "chapter" | "beat" | "cue" | undefined }
/** A bus that sends return to (reverb, delay), with its own fader and effects. */
export interface Bus { id: string; name?: string | undefined; volume?: number | undefined; pan?: number | undefined; muted?: boolean | undefined; effects?: EffectRef[] | undefined }

/** The whole editable project; plain JSON. */
export interface Project {
  version: 1;
  id: string;
  name?: string | undefined;
  fps: number;
  width: number;
  height: number;
  sampleRate?: number | undefined;
  /** Beats per minute (grid, metronome, beat snapping). */
  bpm?: number | undefined;
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  buses: Bus[];
  master: { volume?: number | undefined; effects?: EffectRef[] | undefined; limiter?: boolean | undefined };
  /** Media items (the bin) that clips refer to with `source: { media }`. */
  media?: MediaRef[] | undefined;
  /** Other sequences of the project (nested clips refer to them with `source: { sequence }`); each is a project of its own. */
  sequences?: Project[] | undefined;
  /** Extensions, one namespace each; the core keeps them as they are. */
  ext?: Record<string, unknown> | undefined;
}

let seq = 0;
/** A short unique id (project-local). */
export const newId = (prefix = "c"): string => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

const EPS = 1e-6;
const round = (x: number): number => Math.round(x * 1e6) / 1e6;

/** An empty project (1080p, 30 fps unless given). */
export function emptyProject(o: Partial<Omit<Project, "version">> = {}): Project {
  return { version: 1, id: o.id ?? newId("p"), fps: 30, width: 1920, height: 1080, tracks: [], clips: [], markers: [], buses: [], master: {}, ...o } as Project;
}

const timeMaps = new Map<string, (clip: Clip, t: number) => number>();
/** Register a time map: how a clip's timeline time becomes source time (speed ramps, reverse, freeze). */
export function registerTimeMap(name: string, map: (clip: Clip, t: number) => number): () => void {
  timeMaps.set(name, map);
  return () => { if (timeMaps.get(name) === map) timeMaps.delete(name); };
}
/** The source time shown at timeline time `t` (linear unless the clip names a registered time map). */
export function sourceTime(c: Clip, t: number): number {
  const m = c.timeMap ? timeMaps.get(c.timeMap) : undefined;
  return m ? m(c, t) : c.in + (t - c.start) * (c.speed || 1);
}

/** Length of a clip on the timeline, s. */
export const clipLength = (c: Clip): number => (c.out - c.in) / (c.speed || 1);
/** Where a clip ends on the timeline, s. */
export const clipEnd = (c: Clip): number => round(c.start + clipLength(c));
/** Length of the project: the end of its last clip or marker, s. */
export function projectDuration(p: Project): number {
  let d = 0;
  for (const c of p.clips) d = Math.max(d, clipEnd(c));
  for (const m of p.markers) d = Math.max(d, m.time + (m.duration ?? 0));
  return d;
}
/** The clips of a track, by start time. */
export const trackClips = (p: Project, track: string): Clip[] => p.clips.filter((c) => c.track === track).sort((a, b) => a.start - b.start);
/** The clips under a time (optionally on one track). */
export const clipsAt = (p: Project, t: number, track?: string): Clip[] => p.clips.filter((c) => (!track || c.track === track) && c.start <= t + EPS && clipEnd(c) > t + EPS);
/** A clip by id. */
export const clipById = (p: Project, id: string): Clip | undefined => p.clips.find((c) => c.id === id);
/** The ids a change to `id` also reaches: its linked clips (and itself). */
export function linked(p: Project, id: string): string[] {
  const c = clipById(p, id);
  return c?.link ? p.clips.filter((x) => x.link === c.link).map((x) => x.id) : c ? [id] : [];
}
const isLocked = (p: Project, track: string): boolean => !!p.tracks.find((t) => t.id === track)?.locked;

const mapClips = (p: Project, ids: readonly string[], fn: (c: Clip) => Clip | Clip[] | null): Project => {
  const set = new Set(ids);
  const out: Clip[] = [];
  for (const c of p.clips) {
    if (!set.has(c.id) || isLocked(p, c.track)) { out.push(c); continue; }
    const r = fn(c);
    if (Array.isArray(r)) out.push(...r); else if (r) out.push(r);
  }
  return { ...p, clips: out };
};

// ── tracks, clips, markers ────────────────────────────────────────────────────────────────────────────────────────

/** Add a track (at `index`, default last). */
export function addTrack(p: Project, t: Partial<Track> & { kind: TrackKind }, index = p.tracks.length): Project {
  const track: Track = { id: t.id ?? newId("t"), ...t };
  const tracks = p.tracks.slice();
  tracks.splice(index, 0, track);
  return { ...p, tracks };
}
/** Change a track's fields (mute, solo, volume, pan, name…). */
export const updateTrack = (p: Project, id: string, patch: Partial<Track>): Project => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch, id } : t)) });
/** Remove a track and its clips. */
export const removeTrack = (p: Project, id: string): Project => ({ ...p, tracks: p.tracks.filter((t) => t.id !== id), clips: p.clips.filter((c) => c.track !== id) });
/** Move a track to another row. */
export function moveTrack(p: Project, id: string, index: number): Project {
  const tracks = p.tracks.filter((t) => t.id !== id);
  const t = p.tracks.find((x) => x.id === id);
  if (!t) return p;
  tracks.splice(Math.max(0, Math.min(index, tracks.length)), 0, t);
  return { ...p, tracks };
}
/** Add a clip (`mode` "overwrite": clips under it are cut away; "insert": later clips move right; "free": overlap allowed). */
export function addClip(p: Project, c: Omit<Clip, "id"> & { id?: string }, mode: "overwrite" | "insert" | "free" = "overwrite"): Project {
  const clip: Clip = { ...c, id: c.id ?? newId() } as Clip;
  if (isLocked(p, clip.track)) return p;
  let q = p;
  if (mode === "insert") q = shiftAfter(q, clip.track, clip.start, clipLength(clip));
  else if (mode === "overwrite") q = clear(q, clip.track, clip.start, clipEnd(clip));
  return { ...q, clips: [...q.clips, clip] };
}
/** Change a clip's fields (and nothing else: no rippling). */
export const updateClip = (p: Project, id: string, patch: Partial<Clip>): Project => mapClips(p, [id], (c) => ({ ...c, ...patch, id: c.id }));
/** Add a media item to the bin (a URL; for a recorded Blob / File pass `URL.createObjectURL(blob)` as src). */
export const addMedia = (p: Project, m: Omit<MediaRef, "id"> & { id?: string }): Project => ({ ...p, media: [...(p.media ?? []), { ...m, id: m.id ?? newId("media") } as MediaRef] });
/** Remove a media item from the bin (clips that use it stay, pointing at nothing). */
export const removeMedia = (p: Project, id: string): Project => ({ ...p, media: (p.media ?? []).filter((m) => m.id !== id) });
/** Add a marker / chapter / beat. */
export const addMarker = (p: Project, m: Omit<Marker, "id"> & { id?: string }): Project => ({ ...p, markers: [...p.markers, { ...m, id: m.id ?? newId("m") }].sort((a, b) => a.time - b.time) });
/** Change a marker. */
export const updateMarker = (p: Project, id: string, patch: Partial<Marker>): Project => ({ ...p, markers: p.markers.map((m) => (m.id === id ? { ...m, ...patch, id } : m)).sort((a, b) => a.time - b.time) });
/** Remove a marker. */
export const removeMarker = (p: Project, id: string): Project => ({ ...p, markers: p.markers.filter((m) => m.id !== id) });

/** Cut a range out of a track's clips (the clips around it are trimmed or split); nothing moves. */
export function clear(p: Project, track: string, from: number, to: number): Project {
  if (to <= from + EPS) return p;
  const out: Clip[] = [];
  for (const c of p.clips) {
    const end = clipEnd(c), sp = c.speed || 1;
    if (c.track !== track || end <= from + EPS || c.start >= to - EPS) { out.push(c); continue; }
    if (c.start < from - EPS) out.push({ ...c, out: round(c.in + (from - c.start) * sp), fadeOut: undefined });
    if (end > to + EPS) out.push({ ...c, id: c.start < from - EPS ? newId() : c.id, start: to, in: round(c.in + (to - c.start) * sp), fadeIn: undefined });
  }
  return { ...p, clips: out };
}
/** Move every clip of a track that starts at or after `from` by `delta` seconds. */
export function shiftAfter(p: Project, track: string | null, from: number, delta: number, except: ReadonlySet<string> = new Set()): Project {
  if (!delta) return p;
  return { ...p, clips: p.clips.map((c) => ((track == null || c.track === track) && !except.has(c.id) && c.start >= from - EPS && !isLocked(p, c.track) ? { ...c, start: round(Math.max(0, c.start + delta)) } : c)) };
}

// ── edit operations ───────────────────────────────────────────────────────────────────────────────────────────────

/** Cut a clip in two at a timeline time (its linked clips too). Returns the project; the right halves get new ids. */
export function split(p: Project, id: string, t: number): Project {
  const ids = linked(p, id);
  const newLink = newId("l");
  return mapClips(p, ids, (c) => {
    if (t <= c.start + EPS || t >= clipEnd(c) - EPS) return c;
    const at = round(c.in + (t - c.start) * (c.speed || 1));
    return [{ ...c, out: at, fadeOut: undefined }, { ...c, id: newId(), start: round(t), in: at, fadeIn: undefined, link: c.link ? `${c.link}-${newLink}` : undefined }];
  });
}
/** Blade every unlocked track at a time (or the given tracks). */
export function splitAll(p: Project, t: number, tracks?: readonly string[]): Project {
  let q = p;
  for (const c of p.clips) if ((!tracks || tracks.includes(c.track)) && c.start < t - EPS && clipEnd(c) > t + EPS && q.clips.some((x) => x.id === c.id)) {
    q = mapClips(q, [c.id], (x) => { const at = round(x.in + (t - x.start) * (x.speed || 1)); return [{ ...x, out: at, fadeOut: undefined }, { ...x, id: newId(), start: round(t), in: at, fadeIn: undefined }]; });
  }
  return q;
}
/** Remove clips; `ripple`: later clips on the same tracks close the gap. */
export function remove(p: Project, ids: readonly string[], o: { ripple?: boolean | undefined } = {}): Project {
  const all = new Set(ids.flatMap((id) => linked(p, id)).filter((id) => { const c = clipById(p, id); return c && !isLocked(p, c.track); }));
  let q: Project = { ...p, clips: p.clips.filter((c) => !all.has(c.id)) };
  if (o.ripple) {
    // close each removed span, last first, so earlier spans keep their positions
    const gone = p.clips.filter((c) => all.has(c.id)).sort((a, b) => b.start - a.start);
    for (const c of gone) q = shiftAfter(q, c.track, clipEnd(c), -clipLength(c));
  }
  return q;
}
/** Remove a time range from the whole project (every unlocked track), later clips move left: a jump cut. */
export function cutRange(p: Project, from: number, to: number, tracks?: readonly string[]): Project {
  if (to <= from + EPS) return p;
  let q = p;
  for (const t of p.tracks) if (!t.locked && (!tracks || tracks.includes(t.id))) { q = clear(q, t.id, from, to); q = shiftAfter(q, t.id, to, -(to - from)); }
  q = { ...q, markers: q.markers.filter((m) => m.time < from || m.time >= to).map((m) => (m.time >= to ? { ...m, time: round(m.time - (to - from)) } : m)) };
  return q;
}

/** The free space around a clip on its track: the previous clip's end and the next clip's start. */
export function room(p: Project, c: Clip): { before: number; after: number } {
  let before = 0, after = Infinity;
  for (const x of p.clips) {
    if (x.track !== c.track || x.id === c.id) continue;
    if (clipEnd(x) <= c.start + EPS) before = Math.max(before, clipEnd(x));
    else if (x.start >= clipEnd(c) - EPS) after = Math.min(after, x.start);
  }
  return { before, after };
}

/**
 * Move one edge of a clip to a timeline time. The start edge changes `in`, the end edge `out`; neither goes past the
 * source or (without ripple) into a neighbour. `ripple`: the clips after it move with the edge.
 */
export function trim(p: Project, id: string, edge: "start" | "end", t: number, o: { ripple?: boolean | undefined; minLength?: number | undefined } = {}): Project {
  const c = clipById(p, id);
  if (!c || isLocked(p, c.track)) return p;
  const sp = c.speed || 1, min = o.minLength ?? 1 / 30, r = room(p, c);
  let q = p;
  if (edge === "start") {
    const lo = Math.max(o.ripple ? -Infinity : r.before, c.start - c.in / sp);
    const ns = Math.min(Math.max(t, lo), clipEnd(c) - min);
    const delta = ns - c.start;
    if (o.ripple) {
      // ripple start trim keeps the clip's start and moves what follows by the length change
      q = mapClips(p, [c.id], (x) => ({ ...x, in: round(x.in + delta * sp) }));
      q = shiftAfter(q, c.track, clipEnd(c), -delta, new Set([c.id]));
      return q;
    }
    return mapClips(p, [c.id], (x) => ({ ...x, start: round(ns), in: round(x.in + delta * sp) }));
  }
  const hi = Math.min(o.ripple ? Infinity : r.after, c.sourceDuration != null ? c.start + (c.sourceDuration - c.in) / sp : Infinity);
  const ne = Math.max(Math.min(t, hi), c.start + min);
  const delta = ne - clipEnd(c);
  q = mapClips(p, [c.id], (x) => ({ ...x, out: round(x.out + delta * sp) }));
  if (o.ripple) q = shiftAfter(q, c.track, clipEnd(c) - EPS * 2, delta, new Set([c.id]));
  return q;
}

/** Roll the cut between two touching clips to a new time: one gets longer, the other shorter, nothing else moves. */
export function roll(p: Project, leftId: string, rightId: string, t: number): Project {
  const a = clipById(p, leftId), b = clipById(p, rightId);
  if (!a || !b || a.track !== b.track || isLocked(p, a.track)) return p;
  const sa = a.speed || 1, sb = b.speed || 1;
  const lo = Math.max(a.start + 1 / 30, b.start - b.in / sb);
  const hi = Math.min(clipEnd(b) - 1 / 30, a.sourceDuration != null ? a.start + (a.sourceDuration - a.in) / sa : Infinity);
  const at = Math.min(Math.max(t, lo), hi);
  const d = at - b.start;
  return { ...p, clips: p.clips.map((c) => (c.id === a.id ? { ...c, out: round(c.out + d * sa) } : c.id === b.id ? { ...c, start: round(at), in: round(c.in + d * sb) } : c)) };
}

/** Slip: show another part of the source in the same place and length (in and out move together). */
export function slip(p: Project, id: string, delta: number): Project {
  return mapClips(p, linked(p, id), (c) => {
    const len = c.out - c.in;
    const max = c.sourceDuration != null ? c.sourceDuration - len : Infinity;
    const nin = Math.min(Math.max(0, c.in + delta * (c.speed || 1)), max);
    return { ...c, in: round(nin), out: round(nin + len) };
  });
}

/** Slide: move a clip between its neighbours; the one before ends later / earlier, the one after starts later / earlier. */
export function slide(p: Project, id: string, delta: number): Project {
  const c = clipById(p, id);
  if (!c || isLocked(p, c.track)) return p;
  const list = trackClips(p, c.track);
  const i = list.findIndex((x) => x.id === id);
  const prev = list[i - 1] && Math.abs(clipEnd(list[i - 1]!) - c.start) < 1e-3 ? list[i - 1]! : null;
  const next = list[i + 1] && Math.abs(list[i + 1]!.start - clipEnd(c)) < 1e-3 ? list[i + 1]! : null;
  let d = delta;
  if (prev) d = Math.max(d, -(clipLength(prev) - 1 / 30));
  if (next) d = Math.min(d, clipLength(next) - 1 / 30);
  if (prev?.sourceDuration != null) d = Math.min(d, (prev.sourceDuration - prev.out) / (prev.speed || 1));
  if (next) d = Math.max(d, -next.in / (next.speed || 1));
  if (!prev) d = Math.max(d, -c.start);
  return { ...p, clips: p.clips.map((x) => {
    if (x.id === c.id) return { ...x, start: round(x.start + d) };
    if (prev && x.id === prev.id) return { ...x, out: round(x.out + d * (x.speed || 1)) };
    if (next && x.id === next.id) return { ...x, start: round(x.start + d), in: round(x.in + d * (x.speed || 1)) };
    return x;
  }) };
}

/**
 * Move clips by `delta` seconds (and optionally to another track of the same kind). `mode` "overwrite" (default) cuts
 * what they land on, "insert" pushes later clips right, "free" allows overlap. Linked clips move along.
 */
export function move(p: Project, ids: readonly string[], delta: number, o: { track?: string | undefined; mode?: "overwrite" | "insert" | "free" | undefined } = {}): Project {
  const all = [...new Set(ids.flatMap((id) => linked(p, id)))].map((id) => clipById(p, id)!).filter((c) => c && !isLocked(p, c.track));
  if (!all.length) return p;
  const d = Math.max(delta, -Math.min(...all.map((c) => c.start)));
  const set = new Set(all.map((c) => c.id));
  let q: Project = { ...p, clips: p.clips.filter((c) => !set.has(c.id)) };
  const target = o.track && p.tracks.find((t) => t.id === o.track);
  for (const c of all) {
    const own = target && ids.includes(c.id) && p.tracks.find((t) => t.id === c.track)?.kind === target.kind ? target.id : c.track;
    q = addClip(q, { ...c, start: round(c.start + d), track: own }, o.mode ?? "overwrite");
  }
  return q;
}

/** Change a clip's speed; its timeline length follows (ripple: later clips move). */
export function setSpeed(p: Project, id: string, speed: number, o: { ripple?: boolean | undefined } = {}): Project {
  const c = clipById(p, id);
  if (!c || speed <= 0) return p;
  const delta = (c.out - c.in) / speed - clipLength(c);
  let q = updateClip(p, id, { speed });
  if (o.ripple) q = shiftAfter(q, c.track, clipEnd(c) - EPS * 2, delta, new Set([id]));
  return q;
}

/** Link clips (they move, cut and trim together); `unlink` with no group. */
export function link(p: Project, ids: readonly string[], group: string | undefined = newId("l")): Project {
  return { ...p, clips: p.clips.map((c) => (ids.includes(c.id) ? { ...c, link: group } : c)) };
}

// ── snapping ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A time the timeline snaps to, and what it is (for the snap guide's label). */
export interface SnapTarget { time: number; kind: "clip" | "playhead" | "marker" | "beat" | "grid" | "zero"; id?: string | undefined }
/** Where things snap: clip edges, markers, the playhead, beats (from `bpm`) and grid lines. */
export function snapTargets(p: Project, o: { playhead?: number | undefined; exclude?: readonly string[] | undefined; beats?: boolean | undefined; grid?: number | undefined; to?: number | undefined } = {}): SnapTarget[] {
  const out: SnapTarget[] = [{ time: 0, kind: "grid" }];
  const ex = new Set((o.exclude ?? []).flatMap((id) => linked(p, id)));
  for (const c of p.clips) if (!ex.has(c.id)) out.push({ time: c.start, kind: "clip", id: c.id }, { time: clipEnd(c), kind: "clip", id: c.id });
  for (const m of p.markers) out.push({ time: m.time, kind: m.kind === "beat" ? "beat" : "marker", id: m.id });
  if (o.playhead != null) out.push({ time: o.playhead, kind: "playhead" });
  const end = o.to ?? projectDuration(p) + 10;
  if (o.beats && p.bpm) for (let t = 0, b = 60 / p.bpm; t <= end && out.length < 20000; t += b) out.push({ time: round(t), kind: "beat" });
  if (o.grid) for (let t = 0; t <= end && out.length < 20000; t += o.grid) out.push({ time: round(t), kind: "grid" });
  return out;
}
/** The nearest target within `threshold` seconds of `t`, or null (magnetic snapping). */
export function snap(t: number, targets: readonly SnapTarget[], threshold: number): SnapTarget | null {
  let best: SnapTarget | null = null, bd = threshold;
  for (const s of targets) { const d = Math.abs(s.time - t); if (d <= bd) { bd = d; best = s; } }
  return best;
}
/** The nearest snap for a moving span (start and end both checked): the shift to apply and the target hit. */
export function snapSpan(start: number, end: number, targets: readonly SnapTarget[], threshold: number): { shift: number; target: SnapTarget | null } {
  const a = snap(start, targets, threshold), b = snap(end, targets, threshold);
  const da = a ? a.time - start : Infinity, db = b ? b.time - end : Infinity;
  if (!a && !b) return { shift: 0, target: null };
  return Math.abs(da) <= Math.abs(db) ? { shift: da, target: a } : { shift: db, target: b };
}

/** Round a time to the project's frame grid. */
export const toFrame = (p: Pick<Project, "fps">, t: number): number => Math.round(t * p.fps) / p.fps;
/** "01:02:03:04" timecode (hours:minutes:seconds:frames). */
export function timecode(t: number, fps = 30): string {
  const f = Math.max(0, Math.round(t * fps));
  const ff = f % fps, s = Math.floor(f / fps);
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}:${two(ff)}`;
}
