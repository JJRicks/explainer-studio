// Riemann sums you can see: a region cut into cells, with a column on each cell.
import { THREE, DynMesh, val, Z, onFrame, lerp } from '../engine.js';
import { C, asMap } from './colors.js';
import { polyArea } from './math.js';

const cell = (poly, f) => {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return { poly, cx, cy, area: polyArea(poly), v: f ? f(cx, cy) : 0 };
};

/**
 * Rectangular cells. x: [a, b, nx], y: [c, d, ny].
 *   sample   'mid' (default), 'll' or 'ur' — where in each cell f is evaluated
 *   inside   (x, y) => bool, keeps only cells whose centre passes (crude general regions)
 */
export function rectCells({ x, y, f, inside, sample = 'mid' } = {}) {
  const [a, b, nx] = x, [c, d, ny] = y, hx = (b - a) / nx, hy = (d - c) / ny, out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x0 = a + i * hx, y0 = c + j * hy;
    if (inside && !inside(x0 + hx / 2, y0 + hy / 2)) continue;
    const k = cell([[x0, y0], [x0 + hx, y0], [x0 + hx, y0 + hy], [x0, y0 + hy]]);
    const [sx, sy] = sample === 'll' ? [x0, y0] : sample === 'ur' ? [x0 + hx, y0 + hy] : [k.cx, k.cy];
    k.v = f ? f(sx, sy) : 0;
    out.push(k);
  }
  return out;
}
/** A triangle ABC cut into n*n congruent triangles (so every tile has exactly the same area). f is sampled at centroids. */
export function triangleCells(A, B, Cc, n, f) {
  const P = (i, j) => [A[0] + ((B[0] - A[0]) * i + (Cc[0] - A[0]) * j) / n, A[1] + ((B[1] - A[1]) * i + (Cc[1] - A[1]) * j) / n];
  const out = [];
  for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) {
    out.push(cell([P(i, j), P(i + 1, j), P(i, j + 1)], f));
    if (i + j < n - 1) out.push(cell([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], f));
  }
  return out;
}
/**
 * Polar cells: r: [r0, r1, nr], th: [t0, t1, nt]. Cells farther out are bigger — which is the
 * whole reason for the extra r in dA = r dr dθ. f is sampled at each cell's (r, θ) midpoint.
 */
export function polarCells({ r, th, f, arc = 5 } = {}) {
  const [r0, r1, nr] = r, [t0, t1, nt] = th, out = [];
  for (let i = 0; i < nr; i++) for (let j = 0; j < nt; j++) {
    const ra = lerp(r0, r1, i / nr), rb = lerp(r0, r1, (i + 1) / nr), ta = lerp(t0, t1, j / nt), tb = lerp(t0, t1, (j + 1) / nt);
    const poly = [];
    for (let k = 0; k <= arc; k++) { const t = lerp(ta, tb, k / arc); poly.push([rb * Math.cos(t), rb * Math.sin(t)]); }
    for (let k = arc; k >= 0; k--) { const t = lerp(ta, tb, k / arc); if (ra > 1e-9 || k === arc) poly.push([ra * Math.cos(t), ra * Math.sin(t)]); }
    const rm = (ra + rb) / 2, tm = (ta + tb) / 2, c = cell(poly);
    c.cx = rm * Math.cos(tm); c.cy = rm * Math.sin(tm); c.area = rm * (rb - ra) * (tb - ta); c.v = f ? f(c.cx, c.cy) : 0;
    out.push(c);
  }
  return out;
}
/** Σ f·ΔA over the cells: the Riemann sum. */
export const riemannSum = cells => cells.reduce((s, c) => s + c.v * c.area, 0);
/** Area-weighted mean of f over the cells: the average value estimate. */
export const cellMean = cells => riemannSum(cells) / cells.reduce((s, c) => s + c.area, 0);

/**
 * A column standing on every cell.
 *   height   cell => height in function units (default: the cell's sampled value). Animate it to
 *            grow the columns (c => c.v * g()) or level them to their mean.
 *   shrink   0..1, pulls each cell toward its centre to leave gaps between columns
 *   color    hex, a colormap applied to the height, or (height, cell) => THREE.Color
 */
export function columns({ cells, height = c => c.v, color = C.D, shrink = 0.9, opacity = 1, order = 1 } = {}) {
  const cm = asMap(color), index = [], layout = [];
  let nv = 0;
  for (const c of cells) {
    const m = c.poly.length, o = nv;
    c.q = c.poly.map(p => [c.cx + (p[0] - c.cx) * shrink, c.cy + (p[1] - c.cy) * shrink]);
    for (let k = 1; k + 1 < m; k++) index.push(o, o + k, o + k + 1);          // top face (fan)
    for (let s = 0; s < m; s++) { const b = o + m + 4 * s; index.push(b, b + 1, b + 2, b, b + 2, b + 3); } // sides
    layout.push(o);
    nv += m + 4 * m;
  }
  const mesh = new DynMesh(nv, index, new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }), { colors: true, order });
  onFrame(() => {
    const a = val(opacity);
    if (a < 0.004) { mesh.hide(); return; }
    cells.forEach((c, ci) => {
      const h = height(c, ci), z = Z(h), col = cm(h, c, ci), m = c.q.length, o = layout[ci];
      for (let k = 0; k < m; k++) { mesh.v(o + k, c.q[k][0], c.q[k][1], z); mesh.c(o + k, col); }
      for (let s = 0; s < m; s++) {
        const p = c.q[s], q = c.q[(s + 1) % m], b = o + m + 4 * s;
        mesh.v(b, p[0], p[1], 0); mesh.v(b + 1, q[0], q[1], 0); mesh.v(b + 2, q[0], q[1], z); mesh.v(b + 3, p[0], p[1], z);
        for (let k = 0; k < 4; k++) mesh.c(b + k, col);
      }
    });
    mesh.end(a, { normals: true, solidAbove: 0.6 });
  });
}
