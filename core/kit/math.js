// Small numeric helpers for multivariable calculus pictures.

export const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));
export const range = (a, b, step = 1) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(v); return out; };

/** Numeric partial derivatives of f(x, y). */
export const fx = (f, x, y, h = 1e-4) => (f(x + h, y) - f(x - h, y)) / (2 * h);
export const fy = (f, x, y, h = 1e-4) => (f(x, y + h) - f(x, y - h)) / (2 * h);
/** grad(f) as a field: (x, y) => [fx, fy, 0]. */
export const grad = f => (x, y) => [fx(f, x, y), fy(f, x, y), 0];

export const polar = (r, th) => [r * Math.cos(th), r * Math.sin(th)];
export const cylindrical = (r, th, z) => [r * Math.cos(th), r * Math.sin(th), z];
/** Physics/calculus-text convention: rho = radius, phi = angle down from +z, theta = azimuth. */
export const spherical = (rho, phi, th) => [rho * Math.sin(phi) * Math.cos(th), rho * Math.sin(phi) * Math.sin(th), rho * Math.cos(phi)];

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], (a[2] || 0) + (b[2] || 0)];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)];
export const scale = (a, k) => [a[0] * k, a[1] * k, (a[2] || 0) * k];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = a => Math.hypot(a[0], a[1], a[2] || 0);
export const unit = a => { const n = norm(a) || 1; return scale(a, 1 / n); };

/** Unit normal of a parametric surface r(u, v) -> [x, y, z]. */
export function surfaceNormal(r, u, v, h = 1e-4) {
  const ru = scale(sub(r(u + h, v), r(u - h, v)), 1 / (2 * h));
  const rv = scale(sub(r(u, v + h), r(u, v - h)), 1 / (2 * h));
  return unit(cross(ru, rv));
}
/** Area of a polygon [[x, y], ...] (shoelace). */
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}
