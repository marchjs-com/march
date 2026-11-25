// Path records (26 bytes each) used by vector masks (vmsk / vsms) and the path resources (2000–2997): subpath length
// records, Bezier knots (preceding handle, anchor, leaving handle as 8.24 fixed point relative to the document size)
// and fill rule records.

import type { Anchor, PathData, SubPath } from "../doc/paths.ts";
import { Reader, Writer } from "./binary.ts";

/** Read path records until the reader ends; coordinates come out in document pixels. */
export function readPathRecords(r: Reader, width: number, height: number): { path: PathData; initialFill: boolean } {
  const subpaths: SubPath[] = [];
  let cur: SubPath | null = null, left = 0, initialFill = false;
  const point = (): [number, number] => { const y = r.i32() / 16777216, x = r.i32() / 16777216; return [x * width, y * height]; };
  while (r.left >= 26) {
    const sel = r.u16();
    if (sel === 0 || sel === 3) {
      left = r.u16();
      const op = r.i16(); // newer files: the combine operation (-1 / 1 combine, 0 exclude, 2 subtract, 3 intersect)
      r.skip(20);
      cur = { anchors: [], closed: sel === 0 };
      const ops: SubPath["op"][] = ["exclude", undefined, "subtract", "intersect"];
      if (subpaths.length && op >= 0 && op <= 3 && ops[op]) cur.op = ops[op];
      subpaths.push(cur);
    } else if (sel === 1 || sel === 2 || sel === 4 || sel === 5) {
      const [ix, iy] = point(), [x, y] = point(), [ox, oy] = point();
      const a: Anchor = { x, y, ix, iy, ox, oy, type: sel === 1 || sel === 4 ? "smooth" : "corner" };
      if (cur && left > 0) { cur.anchors.push(a); left--; }
    } else if (sel === 8) { initialFill = r.u16() === 1; r.skip(22); }
    else r.skip(24); // 6 fill rule, 7 clipboard
  }
  return { path: { subpaths }, initialFill };
}

/** Write path records (a fill rule record first, as Photoshop does). */
export function writePathRecords(w: Writer, p: PathData, width: number, height: number): void {
  const fx = (v: number, size: number): number => Math.max(-2147483648, Math.min(2147483647, Math.round((v / size) * 16777216)));
  w.u16(6); w.zeros(24);
  w.u16(8); w.u16(0); w.zeros(22);
  const ops: Record<string, number> = { exclude: 0, add: 1, subtract: 2, intersect: 3 };
  for (const sp of p.subpaths) {
    w.u16(sp.closed ? 0 : 3); w.u16(sp.anchors.length);
    w.i16(sp.op ? ops[sp.op] ?? 1 : 1); w.zeros(20);
    for (const a of sp.anchors) {
      const linked = a.type !== "corner";
      w.u16(sp.closed ? (linked ? 1 : 2) : linked ? 4 : 5);
      for (const [x, y] of [[a.ix, a.iy], [a.x, a.y], [a.ox, a.oy]] as [number, number][]) { w.i32(fx(y, height)); w.i32(fx(x, width)); }
    }
  }
}
