// Coordinate axes with arrowheads, ticks, tick labels and a floor grid.
import { THREE, scene, Segs, mk, K, val, Z, world, onFrame, camScale, clamp01, smooth } from '../engine.js';
import { C } from './colors.js';

const sets = t => (Array.isArray(t) && typeof t[0] === 'object' && t[0] !== null ? t : [{ values: t || [], show: 1 }]);
const fmt = v => String(v).replace('-', '−');

/**
 * axes({ x, y, z, ticks, labels, grid, opacity, zOpacity, gridGlow, pulse })
 *
 *   x, y, z    [lo, hi] or () => [lo, hi]. z is in function units (scaled by world.zs); omit z for 2D.
 *   ticks      { x: [...], y: [...], z: [...] } — or, per axis, several sets that cross-fade:
 *              z: [{ values: [-8, -4, 4, 8], show: () => alpha }, { values: [-50, -100], show }]
 *              (use this when the vertical scale changes and the old ticks stop being readable)
 *   labels     LaTeX for each axis name
 *   grid       { x: [0, 5], y: [0, 5], step: 1 } or null
 *   opacity, zOpacity   numbers or () => number.  The z axis has its own so 2D views can hide it.
 *   pulse      { x, y, z }: () => 0..1, briefly enlarges that axis name
 */
export function axes({
  x = [-0.7, 5.6], y = [-0.7, 5.6], z = null,
  ticks = {}, labels = {}, grid = { x: [0, 5], y: [0, 5], step: 1 },
  opacity = 1, zOpacity = 1, gridGlow = 0, pulse = {},
} = {}) {
  const names = { x: '\\X', y: '\\Y', z: '\\Z', ...labels };
  const tk = { x: sets(ticks.x ?? [1, 2, 3, 4, 5]), y: sets(ticks.y ?? [1, 2, 3, 4, 5]), z: sets(ticks.z ?? []) };
  const rng = { x: () => val(x), y: () => val(y), z: () => (z ? val(z) : [0, 0]) };
  const alpha = { x: () => val(opacity), y: () => val(opacity), z: () => (z ? val(zOpacity) : 0) };
  const pt = { x: v => [v, 0, 0], y: v => [0, v, 0], z: v => [0, 0, Z(v)] };
  // fade a tick out as the axis end sweeps past it
  const inRange = (axis, v) => { const [lo, hi] = rng[axis](); return smooth(clamp01((v - lo - 0.02 * (hi - lo)) / (0.05 * (hi - lo)))) * smooth(clamp01((hi - v - 0.04 * (hi - lo)) / (0.05 * (hi - lo)))); };

  const gridSegs = grid ? new Segs(Math.ceil((grid.x[1] - grid.x[0]) / grid.step + (grid.y[1] - grid.y[0]) / grid.step) + 4, { color: C.grid, width: 1.5, order: 3 }) : null;
  const lines = { x: new Segs(1, { color: C.axis, width: 2.5, order: 6 }), y: new Segs(1, { color: C.axis, width: 2.5, order: 6 }), z: new Segs(1, { color: C.axis, width: 2.5, order: 6 }) };
  const cone = orient => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 20), new THREE.MeshBasicMaterial({ color: C.axis, transparent: true }));
    orient(m); m.renderOrder = 6; scene.add(m);
    return m;
  };
  const cones = { x: cone(m => { m.rotation.z = -Math.PI / 2; }), y: cone(() => {}), z: cone(m => { m.rotation.x = Math.PI / 2; }) };
  const tickDir = { x: [0, 0.07, 0], y: [0.07, 0, 0], z: [0.09, 0, 0] };
  const off = { x: { dy: 24 }, y: { dx: -24 }, z: { dx: -32 } };
  const _g = new THREE.Color();

  for (const axis of ['x', 'y', 'z']) {
    for (const set of tk[axis]) {
      set.segs = new Segs(Math.max(1, set.values.length), { color: C.axis, width: 2, order: 6 });
      for (const v of set.values) {
        mk(fmt(v), { cls: 'tick', kind: 'chrome', pos: () => pt[axis](v), ...off[axis], a: () => alpha[axis]() * val(set.show ?? 1) * inRange(axis, v) });
      }
    }
    mk(K(names[axis]), {
      size: 36, kind: 'chrome', a: alpha[axis], s: pulse[axis] ? () => 1 + 0.6 * pulse[axis]() : undefined,
      pos: () => { const hi = rng[axis]()[1], p = pt[axis](hi), k = 0.45 * camScale(); return [p[0] + (axis === 'x' ? k : 0), p[1] + (axis === 'y' ? k : 0), p[2] + (axis === 'z' ? k : 0)]; },
    });
  }

  onFrame(() => {
    const s = camScale();
    if (gridSegs) {
      gridSegs.begin();
      for (let v = grid.x[0]; v <= grid.x[1] + 1e-9; v += grid.step) gridSegs.seg([v, grid.y[0], 0], [v, grid.y[1], 0]);
      for (let v = grid.y[0]; v <= grid.y[1] + 1e-9; v += grid.step) gridSegs.seg([grid.x[0], v, 0], [grid.x[1], v, 0]);
      const glow = val(gridGlow);
      gridSegs.mat.color.setHex(C.grid).lerp(_g.setHex(0x55606e), glow);
      gridSegs.end(val(opacity) * 0.95);
    }
    for (const axis of ['x', 'y', 'z']) {
      const a = alpha[axis](), [lo, hi] = rng[axis](), tip = pt[axis](hi), d = tickDir[axis];
      lines[axis].begin().seg(pt[axis](lo), tip).end(a);
      const m = cones[axis], k = 0.13 * s;
      m.position.set(tip[0] + (axis === 'x' ? k : 0), tip[1] + (axis === 'y' ? k : 0), tip[2] + (axis === 'z' ? k : 0));
      m.scale.setScalar(s); m.material.opacity = a; m.visible = a > 0.004;
      for (const set of tk[axis]) {
        set.segs.begin();
        for (const v of set.values) {
          if (inRange(axis, v) < 0.5) continue;
          const p = pt[axis](v);
          set.segs.seg([p[0] - d[0], p[1] - d[1], p[2] - d[2]], [p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
        }
        set.segs.end(a * val(set.show ?? 1));
      }
    }
  });
}

/** Cross-fade helpers for tick sets keyed to the vertical scale: showWhenScale(0.3, 0.7) fades in as zs rises through that band. */
export const showWhenScale = (lo, hi) => () => smooth(clamp01((world.zs() - lo) / (hi - lo)));
export const hideWhenScale = (lo, hi) => () => 1 - smooth(clamp01((world.zs() - lo) / (hi - lo)));
