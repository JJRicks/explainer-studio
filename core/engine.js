// Timeline engine. Every visual is a pure function of clock.t, so any frame can be
// rendered on its own — that is what makes frame-exact capture and still review possible.
// Nothing here may depend on wall-clock time, CSS transitions, or state left by an earlier frame.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import katex from 'katex';
import { resolveTime } from './timeexpr.js';

export const W = 1920, H = 1080;
export const clock = { t: 0 };

// ================================================================ easing
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = u => u * u * (3 - 2 * u);
export const lerp = (a, b, u) => a + (b - a) * u;
export const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2] || 0, b[2] || 0, u)];
/** A constant or a function of nothing: lets every kit option be static or animated. */
export const val = x => (typeof x === 'function' ? x() : x);
/** 0 -> 1, starting at t0 (seconds) and taking d seconds. */
export const ramp = (t0, d = 0.6) => smooth(clamp01((clock.t - t0) / d));
/** Visible between t0 and t1 (the fade-out starts at t1). */
export const win = (t0, t1, din = 0.5, dout = 0.45) => ramp(t0, din) * (1 - ramp(t1, dout));
/** 0 -> 1 -> 0 bump lasting d seconds from t0. */
export const bump = (t0, d = 0.8) => Math.sin(Math.PI * clamp01((clock.t - t0) / d));

const mix = (a, b, u) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], u)) : lerp(a, b, u));
/**
 * A keyframed value: holds `init`, then for each [time, seconds, target] eases to target.
 * Values may be numbers or equal-length arrays (camera poses, ranges). Times are time expressions.
 */
export function steps(init, moves) {
  const ms = moves.map(([t, d, target]) => [T(t), d, target]).sort((p, q) => p[0] - q[0]);
  return () => {
    let v = init;
    for (const [t, d, target] of ms) {
      if (clock.t <= t) break;
      v = mix(v, target, smooth(clamp01((clock.t - t) / d)));
    }
    return v;
  };
}
/** The largest of several bumps: a reusable "flash at these moments" signal. */
export function pulses(times, d = 0.9) {
  const ts = times.map(T);
  return () => { let m = 0; for (const t of ts) m = Math.max(m, bump(t, d)); return m; };
}
/** () => visible-between helper taking time expressions. */
export const between = (t0, t1, din = 0.5, dout = 0.45) => { const a = T(t0), b = T(t1); return () => win(a, b, din, dout); };
export const after = (t0, d = 0.6) => { const a = T(t0); return () => ramp(a, d); };

// ================================================================ narration timeline
export let TL = null;
export async function loadTimeline(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`no timeline at ${url} — run "./studio narrate <video>" first`);
  TL = await res.json();
  return TL;
}
/** Time expression -> seconds. See timeexpr.js for the grammar. */
export const T = expr => resolveTime(TL, expr);
export const cs = (id, off = 0) => T(id) + off;
export const ce = (id, off = 0) => T(id + '$') + off;
export const wd = (id, word, n = 1, off = 0) => T(`${id}@${word}#${n}`) + off;
export const ss = cs, se = ce;

// ================================================================ world scale
/**
 * Function values are often far larger than the x/y extent (a surface that falls to -92 over a
 * 5x5 region). Every kit object multiplies heights by world.zs(), so a video can squash or
 * stretch the vertical axis — and animate that — in one place.
 */
export const world = { zs: () => 1 };
export const Z = v => v * world.zs();

// ================================================================ per-frame updaters
const updaters = [];
export const onFrame = fn => { updaters.push(fn); return fn; };
export function frame() { for (const u of updaters) u(); }

// ================================================================ DOM layer (text, equations, labels)
const overlay = document.getElementById('overlay');
const MACROS = {
  '\\X': '\\textcolor{#d2a8ff}{x}', '\\Y': '\\textcolor{#7ee787}{y}', '\\Z': '\\textcolor{#f2cc60}{z}',
  '\\D': '\\textcolor{#58a6ff}{D}', '\\R': '\\textcolor{#58a6ff}{R}',
};
/** Add LaTeX macros for this video, e.g. { '\\F': '8-4\\X^2' }. */
export const defineMacros = more => Object.assign(MACROS, more);
/** LaTeX -> HTML string (display style). Throws on bad LaTeX so mistakes surface at load. */
export function K(latex) {
  return katex.renderToString('\\displaystyle ' + latex, {
    throwOnError: true, trust: true, strict: false, macros: { ...MACROS }, output: 'html',
  });
}
export const nodes = [];
/**
 * Place an HTML element on the 1920x1080 stage.
 *   x, y        stage pixels — or `pos` for a 3D anchor it follows each frame (plus dx, dy pixels)
 *   a           () => opacity
 *   ax, ay      anchor fractions (0 = left/top edge at x/y, 0.5 = centred; 3D labels default centred)
 *   s           () => scale about the element's centre
 *   f           (el, alpha) => void, per-frame hook (dynamic numbers and the like)
 *   size, w, color, cls
 *   nolint      exclude from `./studio check` (deliberate overlays)
 */
export function mk(html, o = {}) {
  const el = document.createElement('div');
  el.className = 'n ' + (o.cls || '');
  el.innerHTML = html;
  if (o.size) el.style.fontSize = o.size + 'px';
  if (o.w) el.style.width = o.w + 'px';
  if (o.color) el.style.color = o.color;
  overlay.appendChild(el);
  const n = {
    el, a: o.a || (() => 1), x: o.x || 0, y: o.y || 0, ax: o.ax ?? (o.pos ? 0.5 : 0), ay: o.ay ?? (o.pos ? 0.5 : 0),
    pos: o.pos, dx: o.dx || 0, dy: o.dy || 0, slide: o.slide ?? (o.pos ? 0 : 12), f: o.f, s: o.s, subs: [],
    kind: o.kind || (o.pos ? 'label' : 'panel'), nolint: !!o.nolint,
  };
  nodes.push(n);
  return n;
}
export const tx = (latex, o = {}) => mk(K(latex), { ...o, cls: 'math ' + (o.cls || '') });

/** Outline a sub-element (CSS selector, usually an \htmlClass name) of a node; alpha is () => 0..1. */
export function ring(node, selector, alpha, { color, pad = 7 } = {}) {
  node.subs.push({ kind: 'ring', selector, alpha, color, pad });
}
/** Fade a sub-element in on its own schedule; alpha is () => 0..1. */
export function reveal(node, selector, alpha) {
  node.subs.push({ kind: 'op', selector, alpha });
}
/** Reveal several sub-elements, each at its own time expression: show(node, [['.a', '1a@one'], ...]). */
export function show(node, pairs, d = 0.35) {
  for (const [selector, t] of pairs) { const t0 = T(t); reveal(node, selector, () => ramp(t0, d)); }
}
/** Strike through a sub-element; progress is () => 0..1. */
export function strike(node, selector, progress) {
  node.subs.push({ kind: 'strike', selector, alpha: progress });
}

/** Measure ring/strike/reveal targets. Runs once, after fonts load and before the first frame. */
export function layoutSubs(scale = 1) {
  for (const n of nodes) {
    const base = n.el.getBoundingClientRect();
    for (const s of n.subs) {
      const targets = [...n.el.querySelectorAll(s.selector)];
      if (!targets.length) throw new Error(`"${s.selector}" not found in: ${n.el.textContent.slice(0, 50)}`);
      if (s.kind === 'op') { s.els = targets; continue; }
      // Union of the glyphs actually drawn: an inline span's own box ignores tall children such as fractions.
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      const drawn = e => e.tagName.toLowerCase() === 'svg' || e.classList.contains('frac-line')
        || (e.children.length === 0 && !e.classList.contains('vlist-s') && e.textContent.replace(/[\s​]/g, '') !== '');
      for (const target of targets) {
        for (const e of [target, ...target.querySelectorAll('*')].filter(drawn)) {
          const q = e.getBoundingClientRect();
          if (!q.width && !q.height) continue;
          l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
        }
      }
      const d = document.createElement('div');
      const [x, y, w, h] = [(l - base.left) / scale, (t - base.top) / scale, (r - l) / scale, (b - t) / scale];
      if (s.kind === 'ring') {
        d.className = 'ring';
        Object.assign(d.style, { left: x - s.pad + 'px', top: y - s.pad + 'px', width: w + 2 * s.pad + 'px', height: h + 2 * s.pad + 'px' });
        if (s.color) d.style.borderColor = s.color;
      } else {
        d.className = 'strike';
        Object.assign(d.style, { left: x - 6 + 'px', top: y + h * 0.72 + 'px', width: Math.hypot(w + 12, h * 0.45) + 'px' });
        s.rot = `rotate(${-Math.atan2(h * 0.45, w + 12)}rad)`;
      }
      n.el.appendChild(d);
      s.el = d;
    }
  }
}

const _v = new THREE.Vector3();
/** World point -> [stage x, stage y, depth]; depth > 1 means behind the camera's far plane. */
export function project(p) {
  _v.set(p[0], p[1], p[2] || 0).project(camera);
  return [(_v.x * 0.5 + 0.5) * W, (-_v.y * 0.5 + 0.5) * H, _v.z];
}
export function updateDom() {
  for (const n of nodes) {
    const a = n.a();
    const s = n.el.style;
    if (!(a >= 0.004)) { s.display = 'none'; continue; }
    s.display = '';
    s.opacity = a.toFixed(3);
    let x = n.x, y = n.y;
    if (n.pos) {
      const p = project(n.pos());
      if (p[2] > 1 || !Number.isFinite(p[0])) { s.display = 'none'; continue; }
      x = p[0] + n.dx; y = p[1] + n.dy;
    }
    s.transform = `translate(${x.toFixed(2)}px, ${(y + (1 - a) * n.slide).toFixed(2)}px) translate(${-n.ax * 100}%, ${-n.ay * 100}%)${n.s ? ` scale(${n.s().toFixed(3)})` : ''}`;
    for (const sub of n.subs) {
      const v = sub.alpha();
      if (sub.kind === 'op') { for (const e of sub.els) e.style.opacity = v.toFixed(3); }
      else if (sub.kind === 'ring') sub.el.style.opacity = v.toFixed(3);
      else sub.el.style.transform = `${sub.rot} scaleX(${v.toFixed(3)})`;
    }
    if (n.f) n.f(n.el, a);
  }
}

/** Layout problems in the frame just rendered: text clipped by the frame edge, or text on top of text. */
export function lintFrame() {
  const shown = nodes
    .filter(n => !n.nolint && n.el.style.display !== 'none' && Number(n.el.style.opacity || 1) > 0.5)
    .map(n => ({ n, r: n.el.getBoundingClientRect(), name: n.el.textContent.replace(/\s+/g, ' ').trim().slice(0, 44) }))
    .filter(q => q.r.width > 0 && q.r.height > 0);
  const issues = [];
  for (const { r, name, n } of shown) {
    const over = Math.max(-r.left, -r.top, r.right - W, r.bottom - (H - 8));
    if (over > 2) issues.push({ type: 'clipped', kind: n.kind, what: name, px: Math.round(over) });
  }
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const p = shown[i], q = shown[j];
      if (p.n.kind !== q.n.kind || p.n.kind === 'chrome') continue;
      const w = Math.min(p.r.right, q.r.right) - Math.max(p.r.left, q.r.left);
      const h = Math.min(p.r.bottom, q.r.bottom) - Math.max(p.r.top, q.r.top);
      if (w <= 0 || h <= 0) continue;
      const share = (w * h) / Math.min(p.r.width * p.r.height, q.r.width * q.r.height);
      if (share > (p.n.kind === 'panel' ? 0.06 : 0.3)) {
        issues.push({ type: 'overlap', kind: p.n.kind, what: `${p.name}  ×  ${q.name}`, px: Math.round(share * 100) });
      }
    }
  }
  return issues;
}

// ================================================================ three.js
export const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('gl'), antialias: true, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(2); // supersampled; the page still screenshots at 1920x1080
renderer.setSize(W, H, false);
renderer.setClearColor(0x0d1117);
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 400);
scene.add(new THREE.AmbientLight(0xffffff, 2.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(6, -9, 14);
scene.add(sun);

export const cam = { r: 16.12 };
/** On-screen size stays constant for things scaled by this (dots, arrowheads, label offsets). */
export const camScale = () => cam.r / 16.12;
/**
 * pose = [azimuth°, polar°, radius, targetX, targetY, targetZ, screenX, screenY]
 * z is up. polar 0 looks straight down (a 2D picture: with azimuth -90, x is right and y is up);
 * larger polar tilts toward the horizon. The target lands at stage pixel (screenX, screenY).
 * At radius r, one world unit is about 2015 / r pixels (125 px at r = 16.12).
 */
export function setCamera(pose) {
  const [thD, phD, r, tx_, ty, tz, cx, cy] = pose;
  const th = (thD * Math.PI) / 180, ph = (phD * Math.PI) / 180;
  const sp = Math.sin(ph), cp = Math.cos(ph);
  camera.position.set(tx_ + r * sp * Math.cos(th), ty + r * sp * Math.sin(th), tz + r * cp);
  camera.up.set(-cp * Math.cos(th), -cp * Math.sin(th), sp);
  camera.lookAt(tx_, ty, tz);
  camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  cam.r = r;
}

/**
 * A batch of fat line segments with a fixed capacity, rewritten every frame:
 *   segs.begin(); segs.seg(a, b) / .line(points) / .dashed(a, b); segs.end(opacity)
 * Render order: opaque depth-writing meshes use order 1; everything translucent comes after.
 */
export class Segs {
  constructor(cap, { color = 0xffffff, width = 3, opacity = 1, order = 5, depthTest = true, colors = false } = {}) {
    this.cap = cap;
    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(new Float32Array(cap * 6));
    this.buf = this.geo.attributes.instanceStart.data;
    this.arr = this.buf.array;
    if (colors) { // per-segment colours: pass a THREE.Color as seg()'s third argument
      this.geo.setColors(new Float32Array(cap * 6).fill(1));
      this.cbuf = this.geo.attributes.instanceColorStart.data;
      color = 0xffffff;
    }
    this.mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest, depthWrite: false, vertexColors: colors });
    this.obj = new LineSegments2(this.geo, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = order;
    this.n = 0;
    scene.add(this.obj);
  }
  begin() { this.n = 0; return this; }
  seg(a, b, color) {
    if (this.n >= this.cap) throw new Error(`Segs capacity ${this.cap} exceeded`);
    const o = this.n * 6, r = this.arr;
    r[o] = a[0]; r[o + 1] = a[1]; r[o + 2] = a[2] || 0; r[o + 3] = b[0]; r[o + 4] = b[1]; r[o + 5] = b[2] || 0;
    if (this.cbuf && color) { const c = this.cbuf.array; c[o] = c[o + 3] = color.r; c[o + 1] = c[o + 4] = color.g; c[o + 2] = c[o + 5] = color.b; }
    this.n++;
    return this;
  }
  line(points) { for (let i = 0; i + 1 < points.length; i++) this.seg(points[i], points[i + 1]); return this; }
  dashed(a, b, dash = 0.14, gap = 0.1) {
    const d = [b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)], len = Math.hypot(...d);
    if (len < 1e-9) return this;
    const at = s => [a[0] + (d[0] * s) / len, a[1] + (d[1] * s) / len, (a[2] || 0) + (d[2] * s) / len];
    for (let s = 0; s < len - 1e-6; s += dash + gap) this.seg(at(s), at(Math.min(len, s + dash)));
    return this;
  }
  /** Finish the frame: set how much is drawn and how visible it is. */
  end(opacity = 1) {
    this.geo.instanceCount = this.n;
    this.buf.needsUpdate = true;
    if (this.cbuf) this.cbuf.needsUpdate = true;
    this.mat.opacity = opacity;
    this.obj.visible = opacity > 0.004 && this.n > 0;
  }
}

/** A mesh whose vertices (and optionally vertex colours) are rewritten every frame. */
export class DynMesh {
  constructor(nVerts, index, material, { colors = false, order = 2 } = {}) {
    this.pos = new Float32Array(nVerts * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    if (colors) {
      this.col = new Float32Array(nVerts * 3);
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    }
    this.geo.setIndex(index);
    this.mat = material;
    this.obj = new THREE.Mesh(this.geo, material);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = order;
    scene.add(this.obj);
  }
  v(i, x, y, z) { this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; }
  c(i, color) { this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b; }
  /** solidAbove: opacity above which the mesh writes depth (and so hides what is behind it). */
  end(opacity = 1, { normals = false, solidAbove = 2 } = {}) {
    this.geo.attributes.position.needsUpdate = true;
    if (this.col) this.geo.attributes.color.needsUpdate = true;
    if (normals) this.geo.computeVertexNormals();
    this.mat.opacity = opacity;
    this.mat.depthWrite = opacity > solidAbove;
    this.obj.visible = opacity > 0.004;
  }
  hide() { this.obj.visible = false; }
}

/** A round marker with a constant on-screen radius of `px`. Returns set(position, opacity, scale). */
export function dot(color, px = 9, order = 9) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
  );
  m.renderOrder = order;
  scene.add(m);
  return (p, opacity = 1, scale = 1) => {
    m.visible = opacity > 0.004;
    m.material.opacity = opacity;
    m.position.set(p[0], p[1], p[2] || 0);
    m.scale.setScalar(((px * scale) / 125) * camScale());
  };
}

export { THREE };
