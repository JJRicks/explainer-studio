// Volume elements in any coordinate system, and grids that morph under a change of variables.
import { THREE, Segs, DynMesh, val, Z, onFrame, lerp } from '../engine.js';
import { C } from './colors.js';
import { flatMaterial } from './region.js';

/**
 * The image of the unit cube under r(a, b, c) -> [x, y, height]: six faces and twelve edges.
 * With the maps below this is a box (dx dy dz), a cylindrical wedge (r dr dθ dz) or a spherical
 * wedge (ρ² sin φ dρ dφ dθ); with your own map it is any 3D change of variables.
 * The map is re-evaluated every frame, so its ranges may be animated.
 */
export function paramSolid({ r, n = 10, color = C.D, opacity = 0.35, edges = 1, edgeColor = C.ink, order = 5 } = {}) {
  const row = n + 1, per = row * row, index = [];
  const faces = [
    (s, t) => [0, s, t], (s, t) => [1, s, t], (s, t) => [s, 0, t], (s, t) => [s, 1, t], (s, t) => [s, t, 0], (s, t) => [s, t, 1],
  ];
  faces.forEach((_, fi) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = fi * per + i * row + j, b = a + row; index.push(a, b, a + 1, b, b + 1, a + 1); } });
  const mesh = new DynMesh(6 * per, index, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true }), { order });
  const lines = new Segs(12 * n, { color: edgeColor, width: 2.5, order: order + 2 });
  const P = (a, b, c) => { const p = r(a, b, c); return [p[0], p[1], Z(p[2])]; };
  const E = [];
  for (const [u, v] of [[0, 0], [0, 1], [1, 0], [1, 1]]) E.push(t => [t, u, v], t => [u, t, v], t => [u, v, t]);
  onFrame(() => {
    const a = val(opacity);
    if (a < 0.004) { mesh.hide(); lines.begin().end(0); return; }
    faces.forEach((face, fi) => { for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const p = P(...face(i / n, j / n)); mesh.v(fi * per + i * row + j, p[0], p[1], p[2]); } });
    mesh.end(a, { normals: true, solidAbove: 0.85 });
    lines.begin();
    for (const e of E) { const pts = []; for (let i = 0; i <= n; i++) pts.push(P(...e(i / n))); lines.line(pts); }
    lines.end(val(edges) * Math.min(1, a * 3));
  });
  return { at: P };
}
const pick = (rng, t) => { const [lo, hi] = val(rng); return lerp(lo, hi, t); };
/** Box: x, y, z each [lo, hi] (or functions returning that). */
export const boxMap = ({ x, y, z }) => (a, b, c) => [pick(x, a), pick(y, b), pick(z, c)];
/** Cylindrical wedge: r, th, z each [lo, hi]. */
export const cylMap = ({ r, th, z }) => (a, b, c) => { const R = pick(r, a), t = pick(th, b); return [R * Math.cos(t), R * Math.sin(t), pick(z, c)]; };
/** Spherical wedge: rho, phi (down from +z), th (azimuth) each [lo, hi]. */
export const sphMap = ({ rho, phi, th }) => (a, b, c) => {
  const R = pick(rho, a), p = pick(phi, b), t = pick(th, c);
  return [R * Math.sin(p) * Math.cos(t), R * Math.sin(p) * Math.sin(t), R * Math.cos(p)];
};

/**
 * A grid in the (u, v) plane and its image under a change of variables (x, y) = T(u, v), drawn on
 * the floor. `morph` slides from the plain grid (0) to its image (1), which is the picture of what
 * a substitution does to area — and why the Jacobian appears.
 *   u, v     [lo, hi, lines]
 *   cell     { u: [u0, u1], v: [v0, v1], color, opacity } highlights one grid cell and its image
 * Returns { at(u, v) -> world point }.
 */
export function gridMap({ T, u, v, morph = 1, colorU = C.u, colorV = C.v, width = 2, opacity = 1, samples = 28, cell = null, order = 5 } = {}) {
  const [u0, u1, nu] = u, [v0, v1, nv] = v;
  const P = (a, b) => { const m = val(morph), q = T(a, b); return [lerp(a, q[0], m), lerp(b, q[1], m), 0.003]; };
  const uLines = new Segs((nu + 1) * samples, { color: colorU, width, order });
  const vLines = new Segs((nv + 1) * samples, { color: colorV, width, order });
  let patch = null; const m = 8;
  if (cell) {
    const index = [];
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; index.push(a, b, a + 1, b, b + 1, a + 1); }
    patch = new DynMesh((m + 1) * (m + 1), index, flatMaterial(cell.color ?? C.z), { order: order - 1 });
  }
  onFrame(() => {
    const a = val(opacity);
    uLines.begin(); vLines.begin();
    if (a > 0.004) {
      for (let i = 0; i <= nu; i++) { const uu = lerp(u0, u1, i / nu), pts = []; for (let k = 0; k <= samples; k++) pts.push(P(uu, lerp(v0, v1, k / samples))); uLines.line(pts); }
      for (let j = 0; j <= nv; j++) { const vv = lerp(v0, v1, j / nv), pts = []; for (let k = 0; k <= samples; k++) pts.push(P(lerp(u0, u1, k / samples), vv)); vLines.line(pts); }
    }
    uLines.end(a); vLines.end(a);
    if (patch) {
      const [ca, cb] = cell.u, [cc, cd] = cell.v;
      for (let i = 0; i <= m; i++) for (let j = 0; j <= m; j++) { const p = P(lerp(ca, cb, i / m), lerp(cc, cd, j / m)); patch.v(i * (m + 1) + j, p[0], p[1], 0.001); }
      patch.end(a * val(cell.opacity ?? 0.6));
    }
  });
  return { at: P };
}
