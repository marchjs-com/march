// canvas2d and webgl drivers: the target is a state object whose fields the engine animates (in place, no
// allocation); the scene is drawn once per frame after all fields are written, and not at all while the canvas is
// off screen. Pausing, speed and reduced motion work the same as for DOM animations.
//   const wave = canvas2d(canvas, (s, ctx) => { … draw with s.phase, s.amp … }, { phase: 0, amp: 20 })
//   animate(wave, { phase: [0, Math.PI * 2], amp: [10, 40] }, { duration: 2000, iterations: Infinity })
//   const sky = webgl(gl, program, { draw: (gl) => gl.drawArrays(gl.TRIANGLES, 0, 6), state: { uTime: 0, uColor: "#36f" } })
import { DRIVER, writeInto, type Driver } from "./drivers.ts";
import type { Track } from "./tracks.ts";
import { parseColor, oklabToRgba } from "./color.ts";

const scratch = new Float64Array(4);

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface Canvas2DTarget<S extends object = Record<string, unknown>> {
  readonly state: S;
  readonly ctx: Ctx2D;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Draw now (e.g. after a resize). */
  draw(): void;
  readonly [DRIVER]: Driver;
}

export const canvas2dDriver: Driver<Canvas2DTarget> = {
  name: "canvas2d",
  supports: (t) => !!t && (t as Canvas2DTarget)[DRIVER] === canvas2dDriver,
  apply: (t, tr) => writeInto(t.state as Record<string, unknown>, tr),
  read: (t, p) => (t.state as Record<string, unknown>)[p] as never,
  flush: (t) => t.draw(),
  element: (t) => ("getBoundingClientRect" in t.canvas ? (t.canvas as HTMLCanvasElement) : null),
};

/** A 2D canvas as an animation target: `draw(state, ctx)` runs once per frame while its state animates. */
export function canvas2d<S extends object>(canvas: HTMLCanvasElement | OffscreenCanvas | Ctx2D, draw: (state: S, ctx: Ctx2D) => void, state: S): Canvas2DTarget<S> {
  const ctx = ("getContext" in canvas ? canvas.getContext("2d") : canvas) as Ctx2D;
  const t: Canvas2DTarget<S> = { state, ctx, canvas: ctx.canvas, draw: () => draw(state, ctx), [DRIVER]: canvas2dDriver as Driver };
  return t;
}

type GL = WebGLRenderingContext | WebGL2RenderingContext;
export interface WebGLTarget<S extends object = Record<string, unknown>> {
  readonly state: S;
  readonly gl: GL;
  readonly program: WebGLProgram;
  /** Upload every uniform and draw now. */
  draw(): void;
  readonly [DRIVER]: Driver;
}
interface GLInternal { locs: Map<string, WebGLUniformLocation | null>; bufs: Map<string, Float32Array>; drawFn: (gl: GL, state: object) => void; uniforms: Record<string, string> }
const internals = new WeakMap<WebGLTarget, GLInternal>();

function upload(t: WebGLTarget, prop: string, value: unknown, tr?: Track): void {
  const g = internals.get(t)!;
  const name = g.uniforms[prop] ?? prop;
  let loc = g.locs.get(name);
  if (loc === undefined) { loc = t.gl.getUniformLocation(t.program, name); g.locs.set(name, loc); }
  if (!loc) return;
  const gl = t.gl;
  if (tr?.kind === 1) {
    let b = g.bufs.get(prop);
    if (!b) g.bufs.set(prop, (b = new Float32Array(4)));
    tr.rgba(b);
    gl.uniform4fv(loc, b);
    return;
  }
  if (typeof value === "number") { gl.uniform1f(loc, value); return; }
  if (typeof value === "string") {
    if (!parseColor(value, scratch)) return;
    let b = g.bufs.get(prop);
    if (!b) g.bufs.set(prop, (b = new Float32Array(4)));
    oklabToRgba(scratch, 0, b);
    gl.uniform4fv(loc, b);
    return;
  }
  if (value && typeof value === "object" && "length" in value) {
    const arr = value as ArrayLike<number>;
    let b = g.bufs.get(prop);
    if (!b || b.length !== arr.length) g.bufs.set(prop, (b = new Float32Array(arr.length)));
    for (let i = 0; i < arr.length; i++) b[i] = arr[i]!;
    if (b.length === 2) gl.uniform2fv(loc, b); else if (b.length === 3) gl.uniform3fv(loc, b); else if (b.length === 4) gl.uniform4fv(loc, b); else gl.uniform1fv(loc, b);
  }
}
const pendingColor = new WeakMap<WebGLTarget, Map<string, Track>>();

export const webglDriver: Driver<WebGLTarget> = {
  name: "webgl",
  supports: (t) => !!t && (t as WebGLTarget)[DRIVER] === webglDriver,
  apply(t, tr) {
    writeInto(t.state as Record<string, unknown>, tr);
    if (tr.kind === 1) { let m = pendingColor.get(t); if (!m) pendingColor.set(t, (m = new Map())); m.set(tr.prop, tr); }
  },
  read: (t, p) => (t.state as Record<string, unknown>)[p] as never,
  flush(t) {
    const colors = pendingColor.get(t);
    t.gl.useProgram(t.program);
    for (const [k, v] of Object.entries(t.state)) { const tr = colors?.get(k); upload(t, k, v, tr); }
    colors?.clear();
    internals.get(t)!.drawFn(t.gl, t.state);
  },
  element: (t) => ("getBoundingClientRect" in t.gl.canvas ? (t.gl.canvas as HTMLCanvasElement) : null),
};

/**
 * A WebGL program as an animation target: every field of `state` is a uniform (number → float, [x, y] → vec2,
 * colors → vec4 in sRGB 0..1). `uniforms` maps a field to another uniform name. `draw(gl)` issues the draw call.
 */
export function webgl<S extends object>(gl: GL, program: WebGLProgram, o: { state: S; draw: (gl: GL, state: S) => void; uniforms?: Record<string, string> }): WebGLTarget<S> {
  const t = { state: o.state, gl, program, draw: () => webglDriver.flush!(t as WebGLTarget), [DRIVER]: webglDriver as Driver } as WebGLTarget<S>;
  internals.set(t as WebGLTarget, { locs: new Map(), bufs: new Map(), drawFn: o.draw as (gl: GL, s: object) => void, uniforms: o.uniforms ?? {} });
  return t;
}
