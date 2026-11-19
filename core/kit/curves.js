// Curves, level curves, and "fences" (a wall standing on a path, up to a height).
import { THREE, Segs, DynMesh, dot, val, Z, onFrame, lerp } from '../engine.js';
import { C, asMap } from './colors.js';

/**
 * A parametric curve r(t) -> [x, y, height]. Use it for graphs y = g(x) (height 0), space curves,
 * paths of integration, and profile curves.
 *   range   [t0, t1] or () => [t0, t1]        draw   0..1, fraction of the range drawn
 * Returns { at(t) -> world point, tangent(t) -> unit world tangent }.
 */
export function curve({ r, range = [0, 1], n = 128, color = C.z, width = 4, opacity = 1, draw = 1, order = 8 } = {}) {
  const segs = new Segs(n, { color, width, order });
  const P = t => { const p = r(t); return [p[0], p[1], Z(p[2] || 0)]; };
  onFrame(() => {
    const a = val(opacity), [t0, t1] = val(range), end = lerp(t0, t1, val(draw));
    segs.begin();
    if (a > 0.004 && Math.abs(end - t0) > 1e-9) { const pts = []; for (let i = 0; i <= n; i++) pts.push(P(lerp(t0, end, i / n))); segs.line(pts); }
    segs.mat.linewidth = val(width);
    segs.end(a);
  });
  return {
    at: P,
    tangent: (t, h = 1e-4) => { const p = P(t - h), q = P(t + h), d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], m = Math.hypot(...d) || 1; return d.map(c => c / m); },
  };
}

/**
 * A wall standing on a floor path, from `base` up to `top`: cross-sections of a solid, slices for
 * partial derivatives (path along x or y), and scalar line integrals (area of the fence = ∫ f ds).
 *
 *   path    s => [x, y], s in `range`
 *   top     height: a number, or a function called as (x, y, s).   base likewise (default 0)
 *   grow    0..1, raises the wall from the base
 *   color   hex or a colormap applied to the top height
 *   outline opacity of the wall's outline
 *   strip   { color, width, opacity, dots } — the path itself drawn on the floor (the "allowed inputs")
 * Returns { at(s, k) -> world point at path position s, fraction k of the way up }.
 */
export function fence({
  path, range = [0, 1], top, base = 0, n = 32, color = C.z, opacity = 0.6, grow = 1, outline = 1, strip = null, order = 6,
} = {}) {
  const cm = asMap(color);
  const H = fn => (typeof fn === 'function' ? fn : () => fn); // called as (x, y, s); shorter signatures just ignore the rest
  const topAt = H(top), baseAt = H(base);
  const index = [];
  for (let i = 0; i < n; i++) { const a = 2 * i; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const mesh = new DynMesh(2 * (n + 1), index, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false }), { colors: true, order });
  const line = new Segs(n + 2, { color: C.ink, width: 2.5, order: order + 2 });
  const S = strip ? { color: C.y, width: 7, opacity: 1, dots: true, ...strip } : null;
  const floor = S ? new Segs(n, { color: S.color, width: S.width, order: order + 2 }) : null;
  const d0 = S?.dots ? dot(S.color, 8) : null, d1 = S?.dots ? dot(S.color, 8) : null;
  const at = (s, k = 1) => { const [x, y] = path(s), b = baseAt(x, y, s); return [x, y, Z(b + (topAt(x, y, s) - b) * k * val(grow))]; };
  onFrame(() => {
    const a = val(opacity), g = val(grow), [s0, s1] = val(range), up = Math.abs(g) > 0.005;
    const tops = [], floorPts = [];
    for (let i = 0; i <= n; i++) {
      const s = lerp(s0, s1, i / n), [x, y] = path(s), b = baseAt(x, y, s), h = topAt(x, y, s), z = b + (h - b) * g;
      mesh.v(2 * i, x, y, Z(b)); mesh.v(2 * i + 1, x, y, Z(z));
      const c = cm(h); mesh.c(2 * i, c); mesh.c(2 * i + 1, c);
      tops.push([x, y, Z(z)]); floorPts.push([x, y, Z(b)]);
    }
    if (up && a > 0.004) mesh.end(a); else mesh.hide();
    line.begin();
    if (up) line.seg(floorPts[0], tops[0]).line(tops).seg(tops[n], floorPts[n]);
    line.end(val(outline) * (a > 0.004 ? 1 : 0));
    if (floor) {
      const sa = val(S.opacity);
      floor.begin().line(floorPts).end(sa);
      d0?.(floorPts[0], sa); d1?.(floorPts[n], sa);
    }
  });
  return { at };
}

/**
 * Level curves f(x, y) = c, by marching squares. Drawn on the floor, or lifted to their own height.
 *   levels   list of c values          n      grid resolution per side
 *   color    hex, or a colormap applied to c
 *   lift     0 = on the floor, 1 = each curve at height c (a "topographic" stack)
 *   dynamic  recompute every frame (only needed if f or levels change with time)
 */
export function contours({ f, levels, x = [0, 5], y = [0, 5], n = 64, color = C.ink, width = 2, opacity = 1, lift = 0, dynamic = false, order = 5 } = {}) {
  const cm = asMap(color);
  const trace = level => {
    const out = [], dx = (x[1] - x[0]) / n, dy = (y[1] - y[0]) / n;
    const g = []; for (let i = 0; i <= n; i++) { g.push(new Float64Array(n + 1)); for (let j = 0; j <= n; j++) g[i][j] = f(x[0] + i * dx, y[0] + j * dy) - level; }
    const cut = (xa, ya, va, xb, yb, vb) => { const t = va / (va - vb); return [xa + (xb - xa) * t, ya + (yb - ya) * t]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = x[0] + i * dx, y0 = y[0] + j * dy, x1 = x0 + dx, y1 = y0 + dy;
      const a = g[i][j], b = g[i + 1][j], c = g[i + 1][j + 1], d = g[i][j + 1];
      const pts = [];
      if ((a > 0) !== (b > 0)) pts.push(cut(x0, y0, a, x1, y0, b));
      if ((b > 0) !== (c > 0)) pts.push(cut(x1, y0, b, x1, y1, c));
      if ((d > 0) !== (c > 0)) pts.push(cut(x0, y1, d, x1, y1, c));
      if ((a > 0) !== (d > 0)) pts.push(cut(x0, y0, a, x0, y1, d));
      if (pts.length === 2) out.push([pts[0], pts[1]]);
      else if (pts.length === 4) { // saddle cell: pair crossings by the sign at the centre
        const pair = (a + b + c + d > 0) === (a > 0) ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
        for (const [p, q] of pair) out.push([pts[p], pts[q]]);
      }
    }
    return out;
  };
  const list = () => val(levels);
  const first = list().map(trace);
  const lines = first.map((segsOf, k) => new Segs(dynamic ? 12 * n : Math.max(1, segsOf.length), { color: cm(list()[k]).getHex(), width, order }));
  const write = (k, segsOf) => { const z = Z(list()[k]) * val(lift) + 0.003; lines[k].begin(); for (const [p, q] of segsOf) lines[k].seg([p[0], p[1], z], [q[0], q[1], z]); };
  onFrame(() => {
    const a = val(opacity);
    lines.forEach((l, k) => { if (a > 0.004) write(k, dynamic ? trace(list()[k]) : first[k]); else l.begin(); l.end(a); });
  });
}
