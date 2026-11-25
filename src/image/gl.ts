// WebGL2 renderer: shows a raster through a 3D LUT on the GPU. While a colour slider moves only the LUT changes
// (N³ entries, built in a few ms), so the full-resolution image updates every frame; the CPU pipeline handles the
// spatial ops before it (see ImageView: CPU prefix, GPU colour suffix). Falls back to Canvas 2D where WebGL2 or float
// textures are missing (glView returns null).
import type { Raster } from "./raster.ts";
import type { Lut3D } from "./lut.ts";

export interface GLView {
  /** Upload the base raster (once per change of the CPU part). */
  setImage(r: Raster): void;
  /** Upload a LUT (null: identity). */
  setLut(lut: Lut3D | null): void;
  /** Draw now. `mix` 0–1 fades from the base (0) to the LUT result (1): the crossfade of a look. */
  draw(mix?: number): void;
  /** The canvas. */
  canvas: HTMLCanvasElement | OffscreenCanvas;
  dispose(): void;
}

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = vec2((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 uv; out vec4 o;
uniform sampler2D img; uniform sampler3D lut; uniform float n; uniform float useLut; uniform float mixv;
vec3 enc(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec4 c = texture(img, uv);
  vec3 lin = c.rgb;
  if (useLut > 0.5) {
    vec3 e = clamp(enc(c.rgb), 0.0, 1.0);
    vec3 l = texture(lut, e * ((n - 1.0) / n) + 0.5 / n).rgb;
    lin = mix(c.rgb, l, mixv);
  }
  o = vec4(clamp(enc(lin), 0.0, 1.0) * c.a, c.a);
}`;

/** A WebGL2 view on a canvas, or null when the browser cannot (no WebGL2 / float textures). */
export function glView(canvas: HTMLCanvasElement | OffscreenCanvas, opts: { space?: "srgb" | "display-p3" | undefined } = {}): GLView | null {
  let gl: WebGL2RenderingContext | null = null;
  try { gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null; } catch { gl = null; }
  if (!gl) return null;
  if (opts.space === "display-p3" && "drawingBufferColorSpace" in gl) try { (gl as unknown as { drawingBufferColorSpace: string }).drawingBufferColorSpace = "display-p3"; } catch { /* sRGB then */ }
  const sh = (type: number, src: string): WebGLShader | null => { const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s); return gl!.getShaderParameter(s, gl!.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string): WebGLUniformLocation | null => gl!.getUniformLocation(prog, n);
  const texImg = gl.createTexture(), texLut = gl.createTexture();
  gl.uniform1i(u("img"), 0); gl.uniform1i(u("lut"), 1);
  let hasLut = false, lutN = 2, w = 0, h = 0;
  // linear filtering of float32 needs an extension; half floats filter everywhere
  const view: GLView = {
    canvas,
    setImage(r) {
      w = r.width; h = r.height;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const half = new Uint16Array(r.data.length);
      for (let i = 0; i < r.data.length; i++) half[i] = toHalf(r.data[i]!);
      gl!.activeTexture(gl!.TEXTURE0); gl!.bindTexture(gl!.TEXTURE_2D, texImg);
      gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA16F, w, h, 0, gl!.RGBA, gl!.HALF_FLOAT, half);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR); gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE); gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    },
    setLut(lut) {
      hasLut = !!lut;
      if (!lut) return;
      lutN = lut.size;
      const n3 = lut.size ** 3, half = new Uint16Array(n3 * 4);
      for (let i = 0; i < n3; i++) { half[i * 4] = toHalf(lut.data[i * 3]!); half[i * 4 + 1] = toHalf(lut.data[i * 3 + 1]!); half[i * 4 + 2] = toHalf(lut.data[i * 3 + 2]!); half[i * 4 + 3] = 0x3c00; }
      gl!.activeTexture(gl!.TEXTURE1); gl!.bindTexture(gl!.TEXTURE_3D, texLut);
      gl!.texImage3D(gl!.TEXTURE_3D, 0, gl!.RGBA16F, lut.size, lut.size, lut.size, 0, gl!.RGBA, gl!.HALF_FLOAT, half);
      for (const p of [gl!.TEXTURE_MIN_FILTER, gl!.TEXTURE_MAG_FILTER]) gl!.texParameteri(gl!.TEXTURE_3D, p, gl!.LINEAR);
      for (const p of [gl!.TEXTURE_WRAP_S, gl!.TEXTURE_WRAP_T, gl!.TEXTURE_WRAP_R]) gl!.texParameteri(gl!.TEXTURE_3D, p, gl!.CLAMP_TO_EDGE);
    },
    draw(mix = 1) {
      if (!w) return;
      gl!.viewport(0, 0, w, h);
      gl!.uniform1f(u("n"), lutN); gl!.uniform1f(u("useLut"), hasLut ? 1 : 0); gl!.uniform1f(u("mixv"), mix);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    },
    dispose() { gl!.deleteTexture(texImg); gl!.deleteTexture(texLut); gl!.deleteBuffer(buf); gl!.deleteProgram(prog); },
  };
  return view;
}

const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
/** float → IEEE half (rounded, clamped to the half range). */
export function toHalf(v: number): number {
  f32[0] = v;
  const x = u32[0]!, sign = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
  if (e <= 0) return e < -10 ? sign : sign | ((m | 0x800000) >> (1 - e + 13));
  if (e >= 31) return sign | 0x7bff;
  return sign | ((e << 10) + ((m + 0x1000) >> 13));
}
