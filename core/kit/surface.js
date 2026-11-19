// Surfaces: graphs z = f(x, y) over a region, general parametric surfaces, and tangent planes.
import { THREE, Segs, DynMesh, val, Z, onFrame, lerp } from '../engine.js';
import { C, asMap } from './colors.js';
import { fx, fy } from './math.js';

const fractions = spec => (Array.isArray(spec) ? spec : Array.from({ length: Math.max(0, (spec || 0) - 1) }, (_, k) => (k + 1) / spec));

/**
 * A parametric surface r(u, v) -> [x, y, height], u and v in [0, 1]. Recomputed every frame, so
 * r may read animated values (a growing domain, a morph, a moving cut).
 *
 *   color     hex, or a colormap applied to the height, or (height, u, v) => THREE.Color
 *   opacity   above 0.6 the surface is solid and hides what is behind it; below, it is see-through
 *   iso       { u: 8, v: 4 } draws that many bands of constant-u / constant-v lines (or pass lists
 *             of fractions); plus { opacity, color, width }
 *   edge      outline opacity, or { opacity, color, width } (color/width may be functions)
 *   walls     opacity of side walls dropped from the boundary to `base` (shows the solid under a graph)
 *   base      height the walls drop to: a number or (x, y) => height. Use the lower surface for a
 *             region between two graphs.
 *
 * Returns { at(u, v) -> world point, height(u, v) }.
 */
export function paramSurface({
  r, nu = 48, nv = 24, color = C.D, opacity = 1, lit = true, iso = null, edge = null, walls = 0, base = 0, order = 1,
} = {}) {
  const cm = asMap(color), row = nv + 1;
  const index = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * row + j, b = a + row; index.push(a, b, a + 1, b, b + 1, a + 1); }
  const Mat = lit ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial;
  const mesh = new DynMesh((nu + 1) * row, index, new Mat({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }), { colors: true, order });

  // walls: four strips, one per parameter edge, each from the base up to the surface
  const hasWalls = walls !== 0;
  const strips = [[nu, t => [t, 0]], [nu, t => [t, 1]], [nv, t => [0, t]], [nv, t => [1, t]]];
  let wallMesh = null;
  if (hasWalls) {
    const wIndex = []; let o = 0;
    for (const [n] of strips) { for (let i = 0; i < n; i++) { const a = o + 2 * i; wIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } o += 2 * (n + 1); }
    wallMesh = new DynMesh(o, wIndex, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false }), { colors: true, order: 5 });
  }
  const baseAt = typeof base === 'function' ? base : () => val(base);

  const E = edge === null ? null : (typeof edge === 'object' ? edge : { opacity: edge });
  const edgeSegs = E ? new Segs(2 * nu + 2 * nv + 4, { color: C.ink, width: 2.5, order: 7 }) : null;
  const I = iso ? { opacity: 0.3, color: 0xffffff, width: 1.6, ...iso, u: fractions(iso.u), v: fractions(iso.v) } : null;
  const isoSegs = I ? new Segs(Math.max(1, I.u.length * nv + I.v.length * nu), { color: I.color, width: I.width, order: 6 }) : null;
  const P = (u, v) => { const p = r(u, v); return [p[0], p[1], Z(p[2])]; };

  onFrame(() => {
    const a = val(opacity);
    if (a < 0.004) { mesh.hide(); wallMesh?.hide(); edgeSegs?.begin().end(0); isoSegs?.begin().end(0); return; }
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv, p = r(u, v), k = i * row + j;
      mesh.v(k, p[0], p[1], Z(p[2])); mesh.c(k, cm(p[2], u, v));
    }
    mesh.end(a, { normals: lit, solidAbove: 0.6 });

    if (wallMesh) {
      let o = 0;
      for (const [n, uv] of strips) {
        for (let i = 0; i <= n; i++) {
          const [u, v] = uv(i / n), p = r(u, v), c = cm(p[2], u, v);
          wallMesh.v(o, p[0], p[1], Z(baseAt(p[0], p[1]))); wallMesh.c(o, c);
          wallMesh.v(o + 1, p[0], p[1], Z(p[2])); wallMesh.c(o + 1, c);
          o += 2;
        }
      }
      wallMesh.end(a * val(walls));
    }
    if (edgeSegs) {
      edgeSegs.begin();
      for (const [n, uv] of strips) { const pts = []; for (let i = 0; i <= n; i++) pts.push(P(...uv(i / n))); edgeSegs.line(pts); }
      if (hasWalls) for (const [u, v] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const p = r(u, v); edgeSegs.seg([p[0], p[1], Z(baseAt(p[0], p[1]))], [p[0], p[1], Z(p[2])]); }
      edgeSegs.mat.color.set(val(E.color ?? C.ink));
      edgeSegs.mat.linewidth = val(E.width ?? 2.5);
      edgeSegs.end(a * val(E.opacity ?? 0.85));
    }
    if (isoSegs) {
      isoSegs.begin();
      for (const u of I.u) { const pts = []; for (let j = 0; j <= nv; j++) pts.push(P(u, j / nv)); isoSegs.line(pts); }
      for (const v of I.v) { const pts = []; for (let i = 0; i <= nu; i++) pts.push(P(i / nu, v)); isoSegs.line(pts); }
      isoSegs.end(a * val(I.opacity));
    }
  });
  return { at: P, height: (u, v) => r(u, v)[2] };
}

/**
 * The graph z = f(x, y) over a domain. `domain` maps the unit square to the region:
 * use rect / overTypeI / overTypeII / overPolar, or write (u, v) => [x, y] yourself.
 * Everything else is as for paramSurface. Pass color: sunset(lo, hi) to colour by height.
 */
export function graphSurface({ f, domain = rect(0, 5, 0, 5), ...rest } = {}) {
  return paramSurface({ r: (u, v) => { const [x, y] = domain(u, v); return [x, y, f(x, y)]; }, ...rest });
}

// ---- domains: unit square -> region. Bounds may be functions of nothing, so regions can grow.
export const rect = (x0, x1, y0, y1) => (u, v) => [lerp(val(x0), val(x1), u), lerp(val(y0), val(y1), v)];
/** a <= x <= b, lo(x) <= y <= hi(x) */
export const overTypeI = (a, b, lo, hi) => (u, v) => { const x = lerp(val(a), val(b), u); return [x, lerp(lo(x), hi(x), v)]; };
/** c <= y <= d, lo(y) <= x <= hi(y) */
export const overTypeII = (c, d, lo, hi) => (u, v) => { const y = lerp(val(c), val(d), v); return [lerp(lo(y), hi(y), u), y]; };
/** r0 <= r <= r1, t0 <= theta <= t1 */
export const overPolar = (r0, r1, t0, t1) => (u, v) => { const r = lerp(val(r0), val(r1), u), t = lerp(val(t0), val(t1), v); return [r * Math.cos(t), r * Math.sin(t)]; };

/**
 * The tangent plane to z = f(x, y) at a point: a square patch of side `size` centred there.
 * `at` is [x, y] or () => [x, y], so the plane can slide along the surface.
 */
export function tangentPlane({ f, at, size = 1.6, color = C.v, opacity = 0.55, edge = 0.9 } = {}) {
  return paramSurface({
    r: (u, v) => {
      const [x0, y0] = val(at), dx = (u - 0.5) * val(size), dy = (v - 0.5) * val(size);
      return [x0 + dx, y0 + dy, f(x0, y0) + fx(f, x0, y0) * dx + fy(f, x0, y0) * dy];
    },
    nu: 1, nv: 1, color, opacity, lit: false, edge: { opacity: edge, color }, order: 6,
  });
}
