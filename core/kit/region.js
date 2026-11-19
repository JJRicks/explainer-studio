// Flat regions on the floor (the domain of integration), and strips sweeping across them
// (the picture behind "which variable goes first, and what are its bounds?").
import { THREE, scene, Segs, DynMesh, dot, val, onFrame, lerp } from '../engine.js';
import { C } from './colors.js';

export const flatMaterial = (color, extra = {}) => new THREE.MeshBasicMaterial({
  color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra,
});

/** Boundary points of a type I region: a <= x <= b, lo(x) <= y <= hi(x). */
export function typeI(a, b, lo, hi, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const x = lerp(a, b, i / n); pts.push([x, lo(x)]); }
  for (let i = n; i >= 0; i--) { const x = lerp(a, b, i / n); pts.push([x, hi(x)]); }
  return dedupe(pts);
}
/** Boundary points of a type II region: c <= y <= d, lo(y) <= x <= hi(y). */
export const typeII = (c, d, lo, hi, n = 48) => typeI(c, d, lo, hi, n).map(([y, x]) => [x, y]);
/** Boundary points of a polar region: t0 <= theta <= t1, r0(theta) <= r <= r1(theta). r0, r1 may be numbers. */
export function polarRegion(t0, t1, r0, r1, n = 64) {
  const R0 = typeof r0 === 'function' ? r0 : () => r0, R1 = typeof r1 === 'function' ? r1 : () => r1;
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = lerp(t0, t1, i / n); pts.push([R1(t) * Math.cos(t), R1(t) * Math.sin(t)]); }
  for (let i = n; i >= 0; i--) { const t = lerp(t0, t1, i / n); pts.push([R0(t) * Math.cos(t), R0(t) * Math.sin(t)]); }
  return dedupe(pts);
}
function dedupe(pts) {
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7) out.push(p); }
  const f = out[0], l = out[out.length - 1];
  if (out.length > 1 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-7) out.pop();
  return out;
}

/**
 * A filled polygon on the floor with an outline that can be drawn on.
 *   points   [[x, y], ...] (fixed shape; use typeI / typeII / polarRegion for curved edges)
 *   fill     fill opacity      line   outline opacity      draw   0..1, fraction of outline drawn
 *   width    outline width in px (number or function — pulse it for emphasis)
 */
export function region(points, { color = C.D, fill = 0.3, line = 1, width = 4, draw = 1, z = 0, order = 4 } = {}) {
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])))), flatMaterial(color));
  mesh.position.z = z; mesh.renderOrder = order; scene.add(mesh);
  const ring = [...points, points[0]].map(p => [p[0], p[1], z + 0.002]);
  const cum = [0];
  for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  const total = cum[cum.length - 1];
  const outline = new Segs(ring.length, { color, width: 4, order: order + 2 });
  onFrame(() => {
    const f = val(fill);
    mesh.visible = f > 0.004; mesh.material.opacity = f;
    const upto = val(draw) * total;
    outline.begin();
    for (let i = 1; i < ring.length && cum[i - 1] < upto; i++) {
      const u = Math.min(1, (upto - cum[i - 1]) / (cum[i] - cum[i - 1]));
      outline.seg(ring[i - 1], [lerp(ring[i - 1][0], ring[i][0], u), lerp(ring[i - 1][1], ring[i][1], u), ring[i][2]]);
    }
    outline.mat.linewidth = val(width);
    outline.end(val(line));
  });
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length, cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return { points, centroid: [cx, cy, z] };
}

/**
 * Strips sweeping across a region: the picture of an iterated integral's bounds.
 *
 *   type 'I'  : vertical strips.   x runs over `range`; each strip goes from y = lo(x) to y = hi(x).   (dy dx)
 *   type 'II' : horizontal strips. y runs over `range`; each strip goes from x = lo(y) to x = hi(y).   (dx dy)
 *
 *   t        where the leading strip is (in the outer variable)
 *   grow     0..1, how much of the leading strip is drawn (animate the inner variable running)
 *   lead     opacity of the leading strip        paint  opacity of the area swept so far
 *   painted  how far the paint extends (defaults to t; set it to 0 until the sweep starts)
 *   ghosts   spacing of the thin strips left behind, or 0 for none
 *
 * Returns { start(), end() }: world positions of the leading strip's two ends, for labels.
 */
export function sweep({ type = 'I', range, lo, hi, t, grow = 1, lead = 1, paint = 0.4, painted, ghosts = 0.25, color = C.y, n = 48 } = {}) {
  const [a, b] = range;
  const P = (o, s) => (type === 'I' ? [o, s, 0] : [s, o, 0]);
  const index = [];
  for (let i = 0; i < n; i++) { const k = 2 * i; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const fill = new DynMesh(2 * (n + 1), index, flatMaterial(color), { order: 4 });
  const count = ghosts ? Math.floor((b - a) / ghosts + 1e-9) + 1 : 0;
  const ghost = new Segs(Math.max(1, count), { color, width: 2, order: 5 });
  const strip = new Segs(1, { color, width: 7, order: 8 });
  const d0 = dot(color, 8), d1 = dot(color, 8);
  const ends = () => { const o = val(t), s0 = lo(o); return [P(o, s0), P(o, s0 + (hi(o) - s0) * val(grow))]; };
  onFrame(() => {
    const upto = Math.min(b, val(painted ?? t)), pa = val(paint), la = val(lead);
    const on = upto > a + 1e-4 && pa > 0.004;
    if (on) {
      for (let i = 0; i <= n; i++) { const o = lerp(a, upto, i / n), p = P(o, lo(o)), q = P(o, hi(o)); fill.v(2 * i, p[0], p[1], 0); fill.v(2 * i + 1, q[0], q[1], 0); }
      fill.end(pa);
    } else fill.hide();
    ghost.begin();
    if (on) for (let k = 0; k < count; k++) { const o = a + k * ghosts; if (o <= upto + 1e-6 && Math.abs(hi(o) - lo(o)) > 1e-6) ghost.seg(P(o, lo(o)), P(o, hi(o))); }
    ghost.end(Math.min(0.75, pa * 1.6));
    const [p, q] = ends();
    strip.begin();
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) strip.seg(p, q);
    strip.end(la);
    d0(p, la); d1(q, la);
  });
  return { start: () => ends()[0], end: () => ends()[1] };
}
