// Palette and colour maps. The CSS variables in index.html carry the same values.
import { THREE } from '../engine.js';

export const C = {
  bg: 0x0d1117, ink: 0xe6edf3, dim: 0x8b949e, axis: 0x9aa4b0, grid: 0x2b323b,
  x: 0xd2a8ff, y: 0x7ee787, z: 0xf2cc60, D: 0x58a6ff, bad: 0xff7b72, good: 0x56d364,
  u: 0xff9e64, v: 0x79c0ff, w: 0xf778ba,
};
/** The same colours for HTML: tag('…', CSS.z). */
export const CSS = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, '#' + v.toString(16).padStart(6, '0')]));

/**
 * colormap([[value, hex], ...]) -> v => THREE.Color (a shared instance: copy it if you keep it).
 * Stops may be listed in either order.
 */
export function colormap(stops) {
  const s = stops.map(([v, hex]) => [v, new THREE.Color(hex)]).sort((a, b) => b[0] - a[0]);
  const out = new THREE.Color();
  return v => {
    if (!(v < s[0][0])) return out.copy(s[0][1]);
    for (let i = 0; i + 1 < s.length; i++) {
      if (v >= s[i + 1][0]) return out.copy(s[i][1]).lerp(s[i + 1][1], (s[i][0] - v) / (s[i][0] - s[i + 1][0]));
    }
    return out.copy(s[s.length - 1][1]);
  };
}
const SUNSET = [0xffe27a, 0xffb347, 0xff8552, 0xf25c78, 0xc44a9e, 0x8a4fd3];
/** Gold at `hi` falling through coral and magenta to violet at `lo`. */
export const sunset = (lo, hi) => colormap(SUNSET.map((hex, i) => [hi - ((hi - lo) * i) / (SUNSET.length - 1), hex]));
/** Warm above zero, cool below: for signed quantities where the sign is the point. */
export const signed = (lo, hi) => colormap([[hi, 0xffe27a], [hi * 0.02, 0xffb347], [0, 0xe6edf3], [lo * 0.02, 0x79c0ff], [lo, 0x8a4fd3]]);
/** A single flat colour, in colormap form. */
export const solid = hex => { const c = new THREE.Color(hex); return () => c; };
/** Accept a hex number or a colormap wherever a kit option says "color". */
export const asMap = color => (typeof color === 'function' ? color : solid(color));
