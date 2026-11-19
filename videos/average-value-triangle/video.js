// Average value of f(x, y) = 8 - 4x² over a triangle: why 1/13.5 was wrong and everything else was right.
//
// Layout of this file:  tracks()  what changes when, keyed to the narration
//                       world()   the 3D objects, built from the kit and driven by the tracks
//                       panels()  the text column
import {
  THREE, scene, Segs, clock, steps, pulses, ramp, win, between, after, cs, ce, wd, ss, se, TL, world, Z,
  K, ring, strike, reveal, show, defineMacros, lerp, clamp01, smooth, onFrame,
} from '../../core/engine.js';
import {
  C, CSS, colormap, axes, showWhenScale, hideWhenScale, region, sweep, graphSurface, curve, fence, columns, triangleCells, cellMean,
  point, segment, label, tag, dropLine, flatMaterial,
} from '../../core/kit/index.js';
import { panel, chapters, OK, NO } from '../../core/panel.js';

const f = x => 8 - 4 * x * x;
const AVG = -26 / 3, R2 = Math.SQRT2;
const ZSF = 0.07;                              // vertical squash once the whole surface is on screen
const PAR_IN = Math.sqrt(3) / 2;               // where y = 8 - 4x² crosses y = 5
const PAR_OUT = (Math.sqrt(129) - 1) / 8;      // ... and y = x
const TILE_NS = [10, 20, 40];
const TRI = [[0, 0], [0, 5], [5, 5]];
const HC = colormap([[8, 0xffe27a], [0, 0xffb347], [-10, 0xff8552], [-30, 0xf25c78], [-60, 0xc44a9e], [-92, 0x8a4fd3]]);
defineMacros({ '\\F': '8-4\\X^2' });

// camera poses: [azimuth, polar, radius, target x/y/z, screen x/y of the target]
const V = {
  flat: [-90, 0, 16.12, 2.5, 2.55, 0, 590, 592],
  wide: [-90, 0, 25.5, 2.5, 2.85, 0, 640, 556],
  point0: [-64, 60, 27, 2.4, 2.4, -0.3, 590, 560],
  point: [-64, 62, 33, 2.4, 2.4, -2.4, 590, 545],
  swing: [-60, 68, 32, 1.9, 2.2, 1.7, 590, 552],
  fall: [-60, 68, 34, 1.9, 2.2, -0.6, 590, 548],
  main: [-52, 62, 19.8, 2.5, 2.6, -2.6, 600, 615],
  main2: [-42, 62, 19.8, 2.5, 2.6, -2.6, 600, 615],
  six: [-40, 64, 19, 2.4, 3.0, -1.9, 600, 600],
  tiles: [-58, 52, 20, 2.5, 2.7, -2.2, 600, 630],
  low: [-48, 70, 18.5, 2.5, 2.6, -1.9, 600, 560],
};

function tracks() {
  const P = {};

  P.cam = steps(V.flat, [
    [wd('3b', 'height'), 3.0, V.point0],
    [wd('3e', 'which') - 0.6, 2.4, V.point],
    [cs('4a') + 0.1, 2.2, V.wide],
    [wd('4d', 'swing'), 2.9, V.swing],
    [wd('4f', 'falling'), 3.0, V.fall],
    [wd('4f', 'squash'), 2.6, V.main],
    [cs('5a'), 22, V.main2],
    [cs('6a'), 2.4, V.six],
    [wd('6f', 'integral') - 1.0, 2.0, V.main],
    [wd('7b', 'dividing') - 0.4, 2.2, V.tiles],
    [cs('7d') - 0.2, 2.2, V.main],
    [cs('8a') + 0.1, 2.4, V.flat],
    [wd('8b', 'height'), 2.8, V.main],
    [cs('9a'), 2.6, V.tiles],
    [wd('9b', 'leveling'), 6.0, V.low],
  ]);

  // ---- axes
  P.zs = steps(1, [[wd('4f', 'squash'), 2.4, ZSF]]);
  P.axes = () => ramp(0.2, 1.0);
  P.gridHL = () => win(wd('3f', 'reference'), se('s3') - 0.6);
  P.yRange = steps([-0.7, 5.6], [[cs('4a') + 0.2, 1.8, [-3.3, 8.5]], [wd('4d', 'swing'), 2.0, [-0.7, 5.6]]]);
  P.zAxis = steps(0, [
    [wd('3b', 'height'), 1.6, 1], [cs('4a') + 0.1, 0.9, 0], [wd('4d', 'swing') + 0.3, 1.5, 1],
    [cs('8a') + 0.1, 0.9, 0], [wd('8b', 'height'), 1.6, 1],
  ]);
  P.zRange = steps([-5.5, 5.5], [[wd('3e', 'which') - 0.6, 1.6, [-9.2, 3.0]], [cs('4a') + 1.2, 0.1, [-5.2, 8.9]], [wd('4f', 'squash'), 2.4, [-97, 16]]]);
  P.yPulse = pulses([wd('4c', 'y')], 1.3);
  P.zPulse = pulses([wd('4d', 'swing') + 2.0], 1.3);

  // ---- the triangle
  P.board = () => win(wd('8a', 'circuit') - 0.4, wd('8b', 'height'), 1.0, 1.0);
  P.triDraw = steps(0, [[wd('0a', 'triangle'), 1.5, 3]]);
  P.triLine = () => ramp(wd('0a', 'triangle'), 0.3) * (1 - P.board());
  P.triPulse = pulses([wd('1d', 'precisely'), wd('1f', 'same', 2), wd('3a', 'triangle'), wd('3c', 'triangle'), wd('4g', 'triangle')], 1.3);
  P.triHL = () => win(wd('7d', 'area', 1) - 0.2, se('s7') - 0.6);
  P.triTag = () => win(wd('7d', 'specified'), se('s7') - 0.6);
  const triBase = steps(0, [[wd('0a', 'triangle') + 1.2, 0.8, 0.3], [wd('1c', 'up') - 0.5, 0.6, 0.1], [wd('1g', 'order'), 1.2, 0.3]]);
  P.triFill = () => (triBase() + 0.22 * P.triPulse() + 0.3 * P.triHL()) * (1 - P.board());
  const vertT = [wd('0a', 'zero', 1), wd('0a', 'zero', 3), wd('0a', 'five', 2)];
  P.vert = vertT.map(t => () => win(t, wd('3b', 'height') - 0.2, 0.35));
  P.vertPulse = [
    pulses([vertT[0], wd('1d', 'zero', 2)], 0.7), pulses([vertT[1], wd('1d', 'zero', 4)], 0.7), pulses([vertT[2], wd('1d', 'five', 3)], 0.7),
  ];
  P.dLabel = () => Math.max(win(wd('0a', 'd'), wd('3b', 'height') - 0.2), win(cs('4a') + 1.6, cs('4d') - 0.2));

  // ---- scene 1: the two orders of integration as strips
  P.hY = steps(3, [[wd('1c', 'y') - 0.1, 0.8, 0], [wd('1c', 'up'), 3.9, 5]]);
  P.hG = steps(0, [[wd('1b', 'from'), 1.2, 1]]);
  P.hLead = () => win(wd('1b', 'x') - 0.2, ce('1c') + 0.3);
  P.hPaintY = () => (clock.t > wd('1c', 'up') ? P.hY() : 0);
  P.hPaint = steps(0, [[wd('1c', 'up'), 0.3, 0.4], [cs('1e'), 0.8, 0.14], [wd('1g', 'order'), 1.2, 0]]);
  P.hLab0 = () => win(wd('1b', 'zero'), wd('1c', 'y') - 0.2, 0.3, 0.3);
  P.hLab1 = () => win(wd('1b', 'y'), wd('1c', 'y') - 0.2, 0.3, 0.3);
  P.vX = steps(2, [[cs('1f') + 0.2, 0.9, 0], [wd('1f', 'sweeping'), 2.9, 5]]);
  P.vG = steps(0, [[wd('1e', 'from', 1), 1.0, 1]]);
  P.vLead = () => win(wd('1e', 'y') - 0.1, wd('1f', 'same', 2));
  P.vPaintX = () => (clock.t > wd('1f', 'sweeping') ? P.vX() : 0);
  P.vPaint = steps(0, [[wd('1f', 'sweeping'), 0.3, 0.4], [wd('1g', 'order'), 1.2, 0]]);
  P.vLab0 = () => win(wd('1e', 'x', 1), cs('1f') + 0.1, 0.3, 0.3);
  P.vLab1 = () => win(wd('1e', 'five', 1), cs('1f') + 0.1, 0.3, 0.3);

  // ---- scene 2: base and height
  P.baseG = steps(0, [[wd('2b', 'base'), 0.7, 1]]);
  P.baseHL = () => win(wd('2b', 'base'), cs('2c') + 0.6);
  P.heightG = steps(0, [[wd('2b', 'height'), 0.7, 1]]);
  P.heightHL = () => win(wd('2b', 'height'), cs('2c') + 0.6);

  // ---- scene 3: inputs on the floor, heights above and below
  P.stemT = wd('3c', 'function');
  P.stems = () => win(P.stemT - 0.1, cs('3d') - 0.1);
  P.pt = () => win(wd('3d', 'two', 1), se('s3') - 0.6);
  P.drop = steps(0, [[wd('3e', 'which'), 1.3, 1]]);
  P.ptTopLabel = () => win(wd('3f', 'two'), se('s3') - 0.6);
  P.floorLabel = () => win(wd('3f', 'reference'), se('s3') - 0.6);

  // ---- scene 4: the parabola, flat then upright, then extruded into the surface
  P.parA = steps(0, [[wd('4a', 'sketch'), 0.3, 1], [ce('4g') + 0.2, 0.7, 0]]);
  P.parX = steps(0.001, [[wd('4a', 'sketch'), 2.8, 1.66], [wd('4d', 'swing'), 2.0, 1.75], [wd('4f', 'falling'), 2.6, 2.3], [wd('4f', 'squash'), 2.4, 5]]);
  P.parAng = steps(0, [[wd('4d', 'swing'), 2.6, 90]]);
  P.cutHL = () => win(wd('4b', 'cut'), cs('4d') - 0.1);
  P.leaveHL = () => win(wd('4b', 'leave'), cs('4d') - 0.1);
  P.fence = () => win(wd('4b', 'fencing'), cs('4d') - 0.1);
  P.parLab0 = () => win(wd('4a', 'eight'), wd('4a', 'same'), 0.4, 0.3);
  P.parLabY = () => win(wd('4a', 'same') + 0.3, cs('4d') + 0.3, 0.4, 0.3);
  P.parLabZ = () => win(wd('4d', 'now'), ce('4g'));
  P.surfY = steps(0, [[wd('4e', 'copied'), 4.0, 5]]);
  P.copy = () => win(wd('4e', 'copied') - 0.3, wd('4e', 'copied') + 4.0, 0.3, 0.6);
  P.surfX = steps(1.75, [[wd('4f', 'falling'), 2.6, 2.3], [wd('4f', 'squash'), 2.4, 5], [wd('8d', 'stopping'), 1.2, R2], [ce('8d') + 0.1, 0.9, 5]]);
  P.surf = steps(0, [
    [wd('4e', 'copied') - 0.3, 0.2, 1], [cs('5a') - 0.3, 0.9, 0.42], [cs('7a'), 0.9, 1], [wd('7b', 'dividing'), 0.8, 0], [cs('7d') - 0.2, 0.9, 1],
    [cs('8a'), 0.8, 0], [wd('8b', 'height') + 0.4, 1.2, 1], [cs('9a'), 0.8, 0],
  ]);
  P.surfBad = pulses([wd('7d', 'curved') - 0.4], 2.6);
  P.levelHL = pulses([wd('6b', 'level') - 0.4], 2.4);

  // ---- scenes 5 and 6: the strip at a fixed x and its curtain
  P.cx = steps(0.15, [
    [wd('5a', 'slide'), 1.6, 0.91], [wd('5c', 'x'), 5.4, 4.6], [cs('6a') + 0.6, 0.2, 2.0],
    [wd('6f', 'integral') - 1.0, 0.9, 0.04], [wd('6f', 'integral'), 4.4, 4.96], [ce('6f') + 0.2, 1.2, 2.0],
  ]);
  P.cStrip = () => Math.max(
    win(cs('5a') + 0.3, cs('6a') - 0.1), win(wd('6d', 'y', 1), se('s6') - 0.6), win(wd('7d', 'cross') - 0.6, se('s7') - 0.6),
  );
  P.cGrow = steps(0, [
    [wd('5b', 'curtain'), 1.0, 1], [cs('6a'), 0.3, 0], [wd('6e', 'integral'), 1.2, 1],
    [se('s6') - 0.3, 0.2, 0], [wd('7d', 'cross') - 0.5, 0.9, 1],
  ]);
  P.cPulse = pulses([wd('6e', 'area')], 1.5);
  P.cEnds = () => win(wd('5a', 'y'), ce('5b'), 0.4);
  P.cLen = () => win(wd('6d', 'length'), wd('6f', 'integral') - 1.0);
  P.cHeight = () => win(wd('6e', 'height'), wd('6f', 'integral') - 1.0);
  P.twoStrips = () => win(wd('6c', 'different', 1) - 0.2, cs('6d') + 0.2);
  P.crossBad = () => win(wd('7d', 'cross') - 0.2, se('s7') - 0.6);
  P.slide = () => win(wd('6a', 'changing') - 0.2, wd('6b', 'f', 1) - 0.1);
  P.slideY = () => 3.5 - 1.5 * Math.cos(((clock.t - wd('6a', 'changing')) * 2 * Math.PI) / 3.4);
  P.three = [1, 2, 3].map(n => () => win(wd('6b', 'f', n), cs('6c') + 0.4, 0.35));
  P.levelG = steps(0, [[wd('6b', 'one'), 0.9, 1]]);

  // ---- scenes 7 and 9: tiles
  P.tiles = [
    () => win(wd('7b', 'dividing'), wd('7c', 'smaller'), 0.6, 0.4),
    () => Math.max(win(wd('7c', 'smaller'), wd('7c', 'settles'), 0.4, 0.4), win(cs('9a') + 0.2, 1e9, 0.8)),
    () => win(wd('7c', 'settles'), cs('7d') - 0.1, 0.4, 0.5),
  ];
  P.tileG = steps(0, [[wd('7b', 'taking'), 1.8, 1]]);
  P.tileL = steps(0, [[wd('9b', 'leveling'), 2.8, 1]]);
  P.avgLine = () => ramp(wd('9b', 'leveling') + 1.6, 1.0);

  // ---- scene 8: circuit board, then the sign change
  P.probes = [0, 1, 2, 3].map(i => () => win(wd('8a', 'measured') + i * 0.22, wd('8b', 'height'), 0.35, 0.6));
  P.probeHL = pulses([wd('8b', 'negative') - 0.2], 2.6);
  P.root2 = () => win(wd('8d', 'square') - 0.2, se('s8') - 0.6);
  P.signTags = () => win(wd('8d', 'height'), wd('8d', 'stopping') - 0.2);
  P.discard = () => win(wd('8d', 'stopping') + 0.5, ce('8d') + 0.1);

  return P;
}

// ====================================================================== 3D world
function world3d(P) {
  world.zs = P.zs;

  axes({
    x: [-0.7, 5.6], y: P.yRange, z: P.zRange,
    ticks: {
      y: [-3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      z: [{ values: [-8, -4, 4, 8], show: showWhenScale(0.3, 0.7) }, { values: [-25, -50, -75], show: hideWhenScale(0.1, 0.3) }],
    },
    opacity: P.axes, zOpacity: P.zAxis, gridGlow: P.gridHL, pulse: { y: P.yPulse, z: P.zPulse },
  });

  // ---- the triangle D
  region(TRI, { fill: P.triFill, line: P.triLine, draw: () => P.triDraw() / 3, width: () => 4 + 4 * P.triPulse() });
  [['(0,0)', -52, 26], ['(0,5)', -54, -24], ['(5,5)', 50, -24]].forEach(([name, dx, dy], i) => {
    point({ at: [...TRI[i], 0], color: C.D, opacity: P.vert[i], scale: () => 1 + 0.9 * P.vertPulse[i]() });
    label(K(name), { at: [...TRI[i], 0], dx, dy, opacity: P.vert[i], cls: 'pt' });
  });
  label(K('\\D'), { at: [1.45, 3.75, 0], size: 48, opacity: P.dLabel });

  // ---- scene 1: strips for the two orders of integration
  const hs = sweep({ type: 'II', range: [0, 5], lo: () => 0, hi: y => y, t: P.hY, grow: P.hG, lead: P.hLead, paint: P.hPaint, painted: P.hPaintY, color: C.x });
  const vs = sweep({ type: 'I', range: [0, 5], lo: x => x, hi: () => 5, t: P.vX, grow: P.vG, lead: P.vLead, paint: P.vPaint, painted: P.vPaintX, color: C.y });
  label(tag(K('\\X = 0')), { at: hs.start, dx: -66, dy: -30, opacity: P.hLab0 });
  label(tag(K('\\X = \\Y')), { at: hs.end, dx: 70, opacity: P.hLab1 });
  label(tag(K('\\Y = \\X')), { at: vs.start, dx: 66, dy: 18, opacity: P.vLab0 });
  label(tag(K('\\Y = 5')), { at: vs.end, dx: 30, dy: -34, opacity: P.vLab1 });

  // ---- scene 2: base and height
  segment({ from: [0, 5, 0], to: [5, 5, 0], color: C.z, width: 8, grow: P.baseG, opacity: P.baseHL });
  segment({ from: [0, 0, 0], to: [0, 5, 0], color: C.z, width: 8, grow: P.heightG, opacity: P.heightHL });
  label(tag('base = 5', CSS.z), { at: [2.9, 5, 0], dy: -36, opacity: P.baseHL });
  label(tag('height = 5', CSS.z), { at: [0, 2.5, 0], dx: -118, opacity: P.heightHL });

  // ---- scene 3: heights at a few sample inputs, then the point (2, 3)
  [[0.9, 1.6], [1.1, 4.2], [1.3, 2.8], [1.6, 4.5], [1.8, 2.6], [1.95, 3.9]].forEach(([x, y], i) => {
    const g = () => smooth(clamp01((clock.t - P.stemT - i * 0.16) / 0.9));
    segment({ from: [x, y, 0], to: () => [x, y, f(x) * g()], width: 2.5, opacity: () => (g() > 0.02 ? P.stems() * 0.85 : 0) });
    point({ at: () => [x, y, f(x) * g()], color: C.z, px: 8, opacity: () => (g() > 0.02 ? P.stems() : 0) });
    point({ at: [x, y, 0], color: C.D, px: 6, opacity: P.stems });
  });
  const drop = dropLine({ at: [2, 3], z: -8, grow: P.drop, opacity: P.pt });
  label(tag(K('(2,\\,3)')), { at: drop.floor, dx: 66, dy: -22, opacity: P.pt });
  label(tag(K('(2,\\,3,\\,\\textcolor{#f2cc60}{-8})')), { at: () => [2, 3, Z(-8)], dx: 104, dy: 6, opacity: P.ptTopLabel });
  label(tag(K('\\text{floor: }\\Z = 0'), CSS.dim), { at: [4.5, 2.7, 0], opacity: P.floorLabel });

  // ---- scene 4: the parabola, drawn flat on the triangle's axes, then swung upright
  const par = curve({
    r: x => { const a = (P.parAng() * Math.PI) / 180; return [x, f(x) * Math.cos(a), f(x) * Math.sin(a)]; },
    range: () => [0, P.parX()], n: 160, color: C.z, width: 4.5, opacity: P.parA,
  });
  curve({ r: x => [x, f(x), 0], range: [PAR_IN, PAR_OUT], n: 40, color: C.bad, width: 7, opacity: P.cutHL, order: 9 });
  point({ at: [PAR_IN, 5, 0], color: C.bad, opacity: P.cutHL });
  point({ at: [PAR_OUT, PAR_OUT, 0], color: C.bad, opacity: P.leaveHL });
  const fencePts = [];
  for (let i = 0; i <= 30; i++) { const x = lerp(PAR_IN, PAR_OUT, i / 30); fencePts.push([x, f(x)]); }
  region([...fencePts, [5, 5]], { color: C.bg, fill: () => 0.72 * P.fence(), line: 0, z: 0.004, order: 5 });
  curve({ r: x => [x, P.surfY(), f(x)], range: () => [0, P.parX()], n: 80, color: C.z, width: 3.5, opacity: P.copy }); // the profile sliding back along y
  const squashed = () => (1 - P.zs()) / (1 - ZSF);
  label(tag(K('\\F'), CSS.z), { at: () => par.at(0.55), dx: 92, opacity: P.parLab0 });
  label(tag(K('\\Y = \\F\\;\\textcolor{#ff7b72}{?}'), CSS.z), { at: () => par.at(0.55), dx: 128, opacity: P.parLabY });
  label(tag(K('\\Z = \\F'), CSS.z), { at: () => par.at(lerp(0.75, 3.6, squashed())), dx: 118, dy: -6, opacity: P.parLabZ, f: el => { el.style.translate = `${-236 * squashed()}px 0`; } });
  label(tag('leaves the triangle?', CSS.bad), { at: [PAR_OUT, PAR_OUT, 0], dx: 158, dy: 22, opacity: P.leaveHL });
  label('<span class="bad" style="font-size:86px;font-weight:700">?</span>', { at: [2.75, 3.95, 0], opacity: P.fence });

  // ---- the surface z = 8 - 4x² over D. Its domain grows: first back along y, then out along x.
  const flash = new THREE.Color(), bad = new THREE.Color(C.bad);
  graphSurface({
    f,
    domain: (u, v) => { const Y = P.surfY(), X = Math.min(P.surfX(), Y), x = X * u; return [x, x + (Y - x) * v]; },
    nu: 64, nv: 20, color: HC, opacity: () => (P.surfY() < 0.002 ? 0 : P.surf()), walls: 0.2,
    iso: { u: 10, v: 4, opacity: () => 0.3 + 0.6 * P.levelHL() },
    edge: { opacity: 0.85, color: () => flash.setHex(C.ink).lerp(bad, P.surfBad()), width: () => 2.5 + 3 * P.surfBad() },
  });
  label(tag('× not the surface\'s area', CSS.bad), { at: () => [3.4, 4.2, Z(f(3.4))], dx: 40, dy: 10, opacity: P.surfBad });

  // ---- scenes 5-7: the strip of allowed inputs at one x, and the curtain hanging from it
  const curtain = fence({
    path: s => { const c = P.cx(); return [c, lerp(c, 5, s)]; }, top: () => f(P.cx()), n: 1, color: HC,
    grow: P.cGrow, opacity: () => P.cStrip() * (0.6 + 0.3 * P.cPulse()), outline: P.cStrip, strip: { color: C.y, opacity: P.cStrip },
  });
  label(tag(K('\\Y = \\X'), CSS.y), { at: () => curtain.at(0, 0), dx: 12, dy: 30, opacity: P.cEnds });
  label(tag(K('\\Y = 5'), CSS.y), { at: () => curtain.at(1, 0), dx: 44, dy: -26, opacity: P.cEnds });
  label(tag(`length ${K('5 - \\X')}`, CSS.y), { at: () => curtain.at(0.5, 0), dx: 12, dy: -34, opacity: P.cLen });
  label(tag(`height ${K('\\F')}`, CSS.z), { at: () => [P.cx(), 5, Z(f(P.cx())) * 0.5], dx: 124, opacity: P.cHeight });
  label(tag('× not a cross-section\'s area', CSS.bad), { at: () => [2, 3.4, Z(f(2)) * 0.5], dx: 60, dy: 44, opacity: P.crossBad });
  segment({ from: [1, 1, 0], to: [1, 5, 0], color: C.y, width: 7, opacity: P.twoStrips, order: 8 });
  segment({ from: [4, 4, 0], to: [4, 5, 0], color: C.y, width: 7, opacity: P.twoStrips, order: 8 });
  label(tag('length 4', CSS.y), { at: [1, 3, 0], dx: -8, dy: -30, opacity: P.twoStrips });
  label(tag('length 1', CSS.y), { at: [4, 4.5, 0], dx: 74, dy: -8, opacity: P.twoStrips });

  // ---- scene 6: one height along y — a point sliding, then three fixed inputs
  const pair = (y, a) => {
    point({ at: () => [2, y(), 0], px: 8, opacity: a });
    point({ at: () => [2, y(), -8], color: C.z, px: 9, opacity: a });
    segment({ from: () => [2, y(), 0], to: () => [2, y(), -8], color: C.dim, width: 2, dashed: [0.1, 0.08], opacity: a });
  };
  pair(P.slideY, P.slide);
  label(tag(K('\\Z = -8'), CSS.z), { at: () => [2, P.slideY(), Z(-8)], dx: 86, dy: 30, opacity: P.slide });
  [2, 3, 5].forEach((y, i) => {
    pair(() => y, P.three[i]);
    label(tag(K(`(2,\\,${y})`)), { at: [2, y, 0], dx: -8, dy: -32, opacity: P.three[i] });
  });
  segment({ from: [2, 2, -8], to: [2, 5, -8], color: C.z, width: 5, grow: P.levelG, opacity: P.three[0], order: 8 });
  label(tag(K('\\Z = -8'), CSS.z), { at: () => [2, 3.6, Z(-8)], dx: 86, dy: 30, opacity: P.three[2] });

  // ---- scenes 7 and 9: equal-area tiles, a column on each, then all levelled to the mean
  const means = TILE_NS.map((n, k) => {
    const cells = triangleCells(TRI[0], TRI[1], TRI[2], n, x => f(x));
    columns({
      cells, shrink: n >= 40 ? 0.84 : 0.9, opacity: P.tiles[k],
      height: c => lerp(c.v, AVG, P.tileL()) * P.tileG(), color: (h, c) => HC(lerp(c.v, AVG, P.tileL())),
    });
    return cellMean(cells);
  });
  TRI.forEach((p, i) => segment({ from: [...p, AVG], to: [...TRI[(i + 1) % 3], AVG], width: 3, opacity: P.avgLine, order: 8 }));
  label(tag(K('\\Z = -\\tfrac{26}{3}')), { at: () => [5, 5, Z(AVG)], dx: 84, dy: 4, opacity: P.avgLine });
  label(tag(`${K('\\checkmark')} ${K('A(\\D)')}: this area`, CSS.good), { at: [1.3, 3.9, 0], dy: -8, opacity: P.triTag });

  // ---- scene 8: the circuit board (bespoke — not kit material), then the sign change at √2
  region(TRI, { color: 0x0f3d2e, fill: () => 0.96 * P.board(), line: 0, z: 0.002 });
  const TRACES = [
    [[0.35, 0.9], [0.35, 4.6]], [[0.7, 1.3], [0.7, 3.4], [1.2, 3.9], [1.2, 4.6]], [[1.05, 1.7], [1.05, 2.9], [1.7, 3.55], [3.0, 3.55]],
    [[1.5, 2.1], [1.5, 2.6], [2.0, 3.1], [2.6, 3.1]], [[1.7, 4.6], [1.7, 4.1], [2.2, 4.1], [2.6, 4.5], [4.2, 4.5]],
    [[3.2, 3.75], [3.6, 4.15], [3.6, 4.72]], [[0.7, 4.2], [0.7, 4.7]], [[2.1, 2.55], [2.1, 2.75], [2.35, 2.75]],
  ];
  const traces = new Segs(24, { color: 0x4fb37c, width: 3.5, order: 5 });
  traces.begin();
  for (const t of TRACES) traces.line(t.map(p => [p[0], p[1], 0.004]));
  const rim = new Segs(3, { color: 0x3fb37c, width: 4, order: 6 });
  rim.begin().line([...TRI, TRI[0]].map(p => [p[0], p[1], 0.004]));
  const pads = TRACES.flatMap(t => [t[0], t[t.length - 1]]).map(p => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), flatMaterial(0xd4a72c));
    m.position.set(p[0], p[1], 0.006); m.renderOrder = 6; scene.add(m);
    return m;
  });
  region([[2.75, 3.85], [3.35, 3.85], [3.35, 4.25], [2.75, 4.25]], { color: 0x1b222c, fill: P.board, line: 0, z: 0.006, order: 6 });
  onFrame(() => {
    const a = P.board();
    traces.end(a * 0.9); rim.end(a);
    pads.forEach(m => { m.visible = a > 0.004; m.material.opacity = a; });
  });
  [[0.5, 2.0], [1.0, 4.0], [2.0, 3.0], [3.0, 4.0]].forEach(([x, y], i) => {
    const v = f(x), hot = i === 2;
    point({ at: [x, y, 0], color: 0xffffff, px: 8, opacity: P.probes[i], scale: () => (hot ? 1 + 0.8 * P.probeHL() : 1) });
    label(tag(`${v > 0 ? '+' : '−'}${Math.abs(v)} V`, v > 0 ? CSS.z : '#ff9a8f'), { at: [x, y, 0], dy: -34, opacity: P.probes[i], scale: () => (hot ? 1 + 0.35 * P.probeHL() : 1) });
  });
  segment({ from: [R2, R2, 0], to: [R2, 5, 0], width: 4, opacity: P.root2, order: 8 });
  region([[R2, R2], [R2, 5], [5, 5]], { color: C.bad, fill: () => 0.4 * P.discard(), line: 0, z: 0.002, order: 5 });
  label(tag(K('\\X = \\sqrt{2}')), { at: [R2, R2, 0], dx: -24, dy: 42, opacity: P.root2 });
  label(tag('height &gt; 0', CSS.z), { at: () => [0.55, 2.6, Z(f(0.55))], dx: -40, dy: -46, opacity: P.signTags });
  label(tag('height &lt; 0', '#ff9a8f'), { at: [3.3, 4.4, 0], dx: 30, dy: -40, opacity: P.signTags });
  label(tag('× thrown away', CSS.bad), { at: [3.1, 4.1, 0], dy: 8, opacity: P.discard });

  return { means };
}

// ====================================================================== text column
const F_AVE = String.raw`f_{\text{ave}}\;{=}\;`;
const eqSub = coef => String.raw`\htmlClass{pc}{${coef}}\,\htmlClass{po}{\int_{0}^{5}}\,\htmlClass{pi}{\int_{0}^{\Y}}\htmlClass{pf}{(8-4\X^2)}\,\htmlClass{pi2}{d\X}\,\htmlClass{po2}{d\Y}`;
const EQ_SUB = eqSub(String.raw`\dfrac{1}{13.5}`);
const EQ_FIX = eqSub(String.raw`\dfrac{2}{25}`);
const EQ_KEY = String.raw`\htmlClass{pc}{\dfrac{2}{25}}\,\htmlClass{po}{\int_{0}^{5}}\,\htmlClass{pi}{\int_{\X}^{5}}\htmlClass{pf}{(8-4\X^2)}\,\htmlClass{pi2}{d\Y}\,\htmlClass{po2}{d\X}`;
const dim = text => `<span class="dim">${text}</span>`;

function panels(P, means) {
  chapters([
    ['s0', 'Q', 'Question 18'], ['s1', '1', 'What you actually submitted'], ['s2', '2', 'The number out front'],
    ['s3', '3', 'The triangle vs. the height'], ['s4', '4', 'The axis swap'], ['s5', '5', 'Inputs and height'],
    ['s6', '6', `We aren’t ignoring ${K('\\Y')}`], ['s7', '7', 'What goes in the denominator?'],
    ['s8', '8', 'Negative values are still values'], ['s9', '9', 'The result'],
  ]);

  { // ------------------------------------------------ 0 · the question
    const S = panel('s0');
    S.label('The question', { at: '0a+0.2' });
    S.text('Set up a double integral for the <b>average value</b> of', { at: '0a@set' });
    S.math(String.raw`f(\X,\Y)\;=\;8-4\X^2`, { at: '0a@f', size: 54 });
    S.text(`on the triangular region ${K('\\D')} with vertices`, { at: '0a@over', gap: 24 });
    const v = S.math(String.raw`\htmlClass{v1}{(0,0),}\;\;\htmlClass{v2}{(0,5),}\;\;\htmlClass{v3}{\text{and }(5,5).}`, { at: '0a@zero-0.1', size: 36, gap: 8 });
    show(v, [['.v1', '0a@zero'], ['.v2', '0a@zero#3'], ['.v3', '0a@five#2']]);
    const head = (left, right = '') => `<div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:19px"><span class="lbl">${left}</span>${right}</div>`;
    const sub = S.text(head('Your answer', '<span class="bad bold wrong">× marked wrong</span>') + K(F_AVE + EQ_SUB), { at: '0b@here', cls: 'card', size: 32, w: 580, gap: 60 });
    reveal(sub, '.wrong', after('0b@wrong', 0.35));
    S.text(head('Answer key') + K(F_AVE + EQ_KEY), { at: '0b@here#2', cls: 'card', size: 32, w: 580, gap: 28 });
  }

  { // ------------------------------------------------ 1 · what you submitted
    const S = panel('s1');
    S.label('Your answer', { at: '1a+0.3' });
    const a = S.math(EQ_SUB, { at: '1a@one-0.2', size: 46, gap: 32 });
    show(a, [['.pc', '1a@one'], ['.po', '1a@integral'], ['.pi', '1a@integral#2'], ['.pf', '1a@eight'], ['.pi2', '1a@d'], ['.po2', '1a@d#2']]);
    ring(a, '.pi, .pi2', between('1b@inner', '1c', 0.3, 0.3), { color: 'var(--x)', pad: 4 });
    ring(a, '.po, .po2', between('1c@outer', '1d', 0.3, 0.3), { color: 'var(--y)', pad: 9 });
    S.text(`${dim('inner:')}&ensp;${K('0\\le\\X\\le\\Y')}`, { at: '1b@x', gap: 32 });
    S.text(`${dim('outer:')}&ensp;${K('0\\le\\Y\\le 5')}`, { at: '1c@y', same: true, dx: 330 });
    const chain = S.math(String.raw`\htmlClass{c1}{0}\htmlClass{c2}{\;\le\;\X}\htmlClass{c3}{\;\le\;\Y}\htmlClass{c4}{\;\le\;5}`, { at: '1d@zero-0.1', size: 52, gap: 30 });
    show(chain, [['.c1', '1d@zero'], ['.c2', '1d@x'], ['.c3', '1d@y'], ['.c4', '1d@five']]);
    ring(chain, '.c1, .c4', pulses(['1f@same-0.2'], 1.8), { pad: 10 });
    S.text(`${OK}&ensp;precisely the triangle ${K('\\D')}`, { at: '1d@precisely', gap: 18 });

    S.label('Answer key', { at: '1e+0.3', gap: 58 });
    const b = S.math(EQ_KEY, { at: '1e+0.5', size: 46, gap: 32 });
    ring(b, '.pi, .pi2', between('1e@y', '1e@then', 0.3, 0.3), { color: 'var(--y)', pad: 4 });
    ring(b, '.po, .po2', between('1e@then', '1f', 0.3, 0.3), { color: 'var(--x)', pad: 9 });
    S.text(`${dim('inner:')}&ensp;${K('\\X\\le\\Y\\le 5')}`, { at: '1e@from', gap: 32 });
    S.text(`${dim('outer:')}&ensp;${K('0\\le\\X\\le 5')}`, { at: '1e@then', same: true, dx: 330 });
    S.text(`${OK}&ensp;Both orders cover the same region.`, { at: '1g+0.3', size: 31, gap: 52 });
    S.text(`${OK}&ensp;The order of integration was <b>not</b> an error.`, { at: '1g@order', size: 31 });
  }

  { // ------------------------------------------------ 2 · the number out front
    const S = panel('s2');
    S.label('Your answer', { at: 's2+0.2' });
    const a = S.math(EQ_SUB, { at: 's2+0.3', size: 46, gap: 32 });
    ring(a, '.pc', between('2a@number', '2c@not', 0.3, 0.3), { color: 'var(--bad)' });
    strike(a, '.pc', after('2c@not+0.3', 0.5));
    const area = S.math(String.raw`\htmlClass{a1}{A(\D)\;{=}\;\tfrac12(5)(5)}\htmlClass{a2}{\;{=}\;\tfrac{25}{2}}\htmlClass{a3}{\;{=}\;12.5}`, { at: '2b@area-0.1', size: 42, gap: 32 });
    show(area, [['.a1', '2b@area'], ['.a2', '2b@twenty-five'], ['.a3', '2b@twelve']]);
    const inv = S.math(String.raw`\htmlClass{b1}{\dfrac{1}{A(\D)}\;{=}\;\dfrac{1}{12.5}}\htmlClass{b2}{\;{=}\;\dfrac{2}{25}}\htmlClass{b3}{\quad\textcolor{#ff7b72}{\ne\;\dfrac{1}{13.5}}}`, { at: '2c@one-0.1', size: 40, gap: 26 });
    show(inv, [['.b1', '2c@one'], ['.b2', '2c@two'], ['.b3', '2c@not']]);
    S.label('Keeping your order of integration', { at: '2d@keeping', gap: 50 });
    const fix = S.math(F_AVE + EQ_FIX, { at: '2d@correct', size: 40, cls: 'box', gap: 14 });
    ring(fix, '.pc', pulses(['2d@two-0.2'], 2.4), { color: 'var(--good)' });
    S.text(`${OK}&ensp;average-value structure`, { at: '2e@average', size: 28, gap: 38 });
    S.text(`${OK}&ensp;the function`, { at: '2e@function', size: 28, gap: 10 });
    S.text(`${OK}&ensp;the region`, { at: '2e@region', size: 28, gap: 10 });
    S.text(`${NO}&ensp;the denominator ${dim('— the one remaining error')}`, { at: '2e@denominator', size: 28, gap: 10 });
  }

  { // ------------------------------------------------ 3 · triangle vs. height
    const S = panel('s3', { y: 150 });
    S.text('What is the <span class="cD">triangle</span>?', { at: '3a@what', size: 40, cls: 'bold' });
    S.text('What is the <span class="cz">height</span>?', { at: '3a@what#2', size: 40, cls: 'bold', gap: 4 });
    S.math(String.raw`\Z\;=\;f(\X,\Y)\;=\;8-4\X^2`, { at: '3b@z', size: 46, gap: 40 });
    S.text(`<span class="cD bold">Triangle</span> ${K('\\D')}&ensp;→&ensp;the input locations ${K('(\\X,\\Y)')}`, { at: '3c@triangle', gap: 36 });
    S.text(`<span class="cz bold">Function</span> ${K('f')}&ensp;→&ensp;a height ${K('\\Z')} at each location`, { at: '3c@function', gap: 10 });
    S.label('Example', { at: '3d+0.2', gap: 56 });
    const e1 = S.text(`${K('(2,3)')} is inside ${K('\\D')}:&emsp;${K('\\htmlClass{q}{0\\le 2\\le 3\\le 5}')}`, { at: '3d@two', size: 32 });
    reveal(e1, '.q', after('3d@zero', 0.4));
    const e2 = S.math(String.raw`\htmlClass{f1}{f(2,3)}\htmlClass{f2}{\;{=}\;8-4(2)^2}\htmlClass{f3}{\;{=}\;\textcolor{#f2cc60}{{-}8}}`, { at: '3e@f-0.1', size: 42, gap: 28 });
    show(e2, [['.f1', '3e@f'], ['.f2', '3e@eight'], ['.f3', '3e@negative']]);
    S.text(`point on the surface:&ensp;${K('(2,\\,3,\\,\\textcolor{#f2cc60}{-8})')}`, { at: '3f@two', size: 32, gap: 32 });
    S.text(`The <b>input</b> ${K('(2,3)')} is still inside the triangle.`, { at: '3f@input', size: 28, gap: 52 });
    S.text(`Its <b>output</b> just sits below the plane ${K('\\Z=0')}.`, { at: '3f@output', size: 28, gap: 10 });
  }

  { // ------------------------------------------------ 4 · the axis swap
    const S = panel('s4', { y: 150 });
    S.text(`Sketch ${K('\\F')} as a familiar parabola…`, { at: '4a@sketch' });
    S.text('…and it lands on the <b>triangle’s axes</b>.', { at: '4a@mentally', gap: 8 });
    S.text('<span class="bad">It seems to cut through the triangle, then leave it.</span>', { at: '4b@cut-0.3', out: '4d', size: 27, gap: 30 });
    S.text('Two pictures, two different vertical axes:', { at: '4c@vertical', size: 27, cls: 'dim', gap: 54 });
    S.text(`Triangle’s vertical axis:&ensp;${K('\\Y')}`, { at: "4c@triangle's", size: 38, gap: 12 });
    S.text(`Parabola’s vertical axis:&ensp;${K('\\Z')}`, { at: "4c@parabola's", size: 38, gap: 8 });
    S.text(`${K('\\Z=\\F')} is a <b>height profile</b> over the ${K('\\X')}-axis.`, { at: '4d@now', gap: 56 });
    S.text(`No ${K('\\Y')} in the formula → the same profile all along ${K('\\Y')}.`, { at: '4e@formula', gap: 12 });
    S.text(`At ${K('\\X=5')}:&ensp;${K('8-4(5)^2=-92')}`, { at: '4f@negative', gap: 36 });
    S.text('(vertical scale squashed to fit)', { at: '4f@squash', size: 24, cls: 'dim', gap: 8 });
    S.text('<span class="cD bold">Triangle</span>&ensp;→&ensp;<b>where</b> we integrate', { at: '4g@triangle', size: 34, gap: 60 });
    S.text('<span class="cz bold">Parabola</span>&ensp;→&ensp;<b>how high</b>', { at: '4g@parabola#2', size: 34, gap: 10 });
  }

  { // ------------------------------------------------ 5 · inputs and height (the slider)
    const S = panel('s5', { y: 156 });
    const num = fn => el => { el.querySelector('.q').textContent = fn().toFixed(2).replace('-', '−'); };
    S.text(`${K('\\X\\;=')}&ensp;<span class="knum cx q"></span>`, { at: '5a@slide', size: 54, f: num(P.cx) });
    S.label('Allowed inputs — the strip on the floor', { at: '5a@floor', gap: 50 });
    S.text(`<span class="knum q"></span>&ensp;${K('\\le\\;\\Y\\;\\le\\;5')}`, { at: '5a@strip', size: 42, f: num(P.cx) });
    S.text(`${dim('strip length')}&ensp;<span class="knum cy q"></span>`, { at: '5a@y', size: 28, f: num(() => 5 - P.cx()), gap: 8 });
    S.label('Height assigned to them — the curtain', { at: '5b@curtain', gap: 58 });
    S.text(`${K('\\Z\\;=\\;\\F\\;=')}&ensp;<span class="knum cz q"></span>`, { at: '5b@height', size: 42, f: num(() => f(P.cx())) });
    const sign = S.text('<span class="cz">above the floor</span>', { at: '5b@same', size: 28, gap: 10, f: el => { el.firstChild.style.visibility = f(P.cx()) >= 0 ? 'visible' : 'hidden'; } });
    S.text('<span style="color:#ff9a8f">below the floor — a negative height</span>', { at: '5b@same', size: 28, over: true, f: el => { el.firstChild.style.visibility = f(P.cx()) < 0 ? 'visible' : 'hidden'; } });
    S.text('The strip gets shorter, the height drops below zero…', { at: '5c@strip', size: 28, gap: 80 });
    S.text('…and the inputs never leave the triangle.', { at: '5c@inputs', size: 28, gap: 10 });
  }

  { // ------------------------------------------------ 6 · we aren't ignoring y
    const S = panel('s6');
    S.text(`No ${K('\\Y')} in the formula means: changing ${K('\\Y')}, with ${K('\\X')} fixed, doesn’t change the output.`, { at: '6a@formula', size: 28, wrap: true });
    const e = S.math(String.raw`\htmlClass{g1}{f(2,2)}\htmlClass{g2}{\;{=}\;f(2,3)}\htmlClass{g3}{\;{=}\;f(2,5)}\htmlClass{g4}{\;{=}\;\textcolor{#f2cc60}{{-}8}}`, { at: '6b@f-0.1', size: 40, gap: 26 });
    show(e, [['.g1', '6b@f'], ['.g2', '6b@f#2'], ['.g3', '6b@f#3'], ['.g4', '6b@negative']]);
    S.text(`But the triangle gives <b>different amounts of area</b> at different ${K('\\X')}.`, { at: '6c@because', size: 27, wrap: true, gap: 30 });
    const st = S.math(String.raw`\htmlClass{s1}{\X\le\Y\le 5}\htmlClass{s2}{\quad\Longrightarrow\quad\text{strip length}\;\;5-\X}`, { at: '6d@y-0.1', size: 36, gap: 24 });
    show(st, [['.s1', '6d@y'], ['.s2', '6d@length']]);
    const i1 = S.math(String.raw`\htmlClass{i1}{\int_{\X}^{5}(8-4\X^2)\,d\Y}\htmlClass{i2}{\;{=}\;}\htmlClass{i3}{(8-4\X^2)}\,\htmlClass{i4}{(5-\X)}`, { at: '6e@integral-0.1', size: 40, gap: 30 });
    show(i1, [['.i1', '6e@integral'], ['.i2', '6e@equals'], ['.i3', '6e@eight#2'], ['.i4', '6e@five#2']]);
    const i1b = S.math(String.raw`\phantom{{\int_{\X}^{5}(8-4\X^2)\,d\Y}{\;{=}\;}}\htmlClass{u1}{\underbrace{\phantom{(8-4\X^2)}}_{\text{height}}}\,\htmlClass{u2}{\underbrace{\phantom{(5-\X)}}_{\text{length}}}`, { at: '6e@height-0.1', size: 40, color: 'var(--z)', over: true });
    show(i1b, [['.u1', '6e@height'], ['.u2', '6e@length']]);
    const av = S.math(String.raw`\htmlClass{k0}{f_{\text{ave}}\;{=}\;}\htmlClass{k1}{\dfrac{2}{25}}\htmlClass{k2}{\int_{0}^{5}}\htmlClass{k3}{(8-4\X^2)}\,\htmlClass{k4}{(5-\X)}\,\htmlClass{k5}{d\X}`, { at: '6f@average-0.1', size: 42, gap: 78 });
    show(av, [['.k0', '6f@average'], ['.k1', '6f@two'], ['.k2', '6f@integral'], ['.k3', '6f@height'], ['.k4', '6f@length'], ['.k5', '6f@d']]);
    const avb = S.math(String.raw`\phantom{{f_{\text{ave}}\;{=}\;}{\dfrac{2}{25}}{\int_{0}^{5}}}\htmlClass{w1}{\underbrace{\phantom{(8-4\X^2)}}_{\text{height}}}\,\htmlClass{w2}{\underbrace{\phantom{(5-\X)}}_{\mathclap{\text{length of the strip}}}}`, { at: '6f@height-0.1', size: 42, color: 'var(--z)', over: true });
    show(avb, [['.w1', '6f@height'], ['.w2', '6f@length']]);
    S.text('The <span class="cz bold">function</span> supplies the height.', { at: '6g@function', size: 28, gap: 84 });
    S.text('The <span class="cD bold">region</span> supplies how much area receives that height.', { at: '6g@region', size: 28, gap: 10 });
  }

  { // ------------------------------------------------ 7 · the denominator
    const S = panel('s7', { y: 150 });
    S.text('What area goes in the denominator?', { at: '7a+0.3', size: 36, cls: 'bold' });
    const d = S.math(String.raw`\htmlClass{d0}{f_{\text{ave}}\;{=}\;}\htmlClass{d1}{\dfrac{1}{A(\D)}}\htmlClass{d2}{\iint_{\D}f(\X,\Y)\,dA}`, { at: '7a@definition', size: 44, cls: 'box', gap: 34 });
    show(d, [['.d1', '7a@one'], ['.d2', '7a@double']]);
    ring(d, '.d1', between('7d@denominator', 's7$-0.6', 0.3), { pad: 8 });
    S.label('Simple average of the tile values', { at: '7b@averaging-0.4', gap: 46 });
    const rowAt = ['7b@averaging', '7c@smaller+0.5', '7c@settles+0.4'];
    TILE_NS.forEach((n, k) => {
      S.text(`${K(String(n * n))} tiles`, { at: rowAt[k], gap: k ? 12 : undefined });
      S.text(`${dim('→')}&ensp;${K(means[k].toFixed(3))}`, { at: rowAt[k], same: true, dx: 190 });
    });
    S.text(`${dim('settling toward')}&ensp;${K('-8.666\\ldots')}`, { at: '7c@down', gap: 12 });
    S.text(`${OK}&ensp;the triangle’s area in the ${K('\\X\\Y')}-plane:&ensp;${K('A(\\D)=\\tfrac{25}{2}')}`, { at: '7d@area', size: 28, gap: 60 });
    S.text(`${NO}&ensp;not the area of the curved surface`, { at: '7d@not', size: 28, gap: 14 });
    S.text(`${NO}&ensp;not the area of a cross-section`, { at: '7d@not#2', size: 28, gap: 14 });
  }

  { // ------------------------------------------------ 8 · negative values are still values
    const S = panel('s8', { y: 150 });
    S.label('An electronics version', { at: '8a+0.3' });
    S.text(`${K('\\D')}&ensp;=&ensp;a triangular circuit board`, { at: '8a@triangular', size: 32 });
    S.text(`${K('f(\\X,\\Y)')}&ensp;=&ensp;the voltage at each location`, { at: '8a@voltage', size: 32, gap: 10 });
    S.text('A reading of <b>−8 V</b> doesn’t remove that location from the board.', { at: '8b@reading', size: 28, wrap: true, gap: 50 });
    S.text('It contributes a negative number to the average.', { at: '8b@contributes', size: 28, gap: 10 });
    S.text('Negative values are still values.', { at: '8c@negative', size: 40, cls: 'bold', gap: 60 });
    const r = S.math(String.raw`\htmlClass{r1}{\X>\sqrt{2}}\htmlClass{r2}{\quad\Longrightarrow\quad 8-4\X^2<0}`, { at: '8d@x-0.1', size: 40, gap: 40 });
    show(r, [['.r1', '8d@x'], ['.r2', '8d@height']]);
    S.text('Those contributions stay in the average.', { at: '8d@those', size: 28, gap: 40 });
    S.text(`<span class="bad">Stopping at ${K('\\sqrt2')} would throw away part of the region.</span>`, { at: '8d@stopping', size: 28, gap: 10 });
  }

  { // ------------------------------------------------ 9 · the result
    const S = panel('s9', { y: 150, out: TL.duration - 0.8 });
    S.math(F_AVE + EQ_FIX, { at: '9a+0.3', size: 38 });
    const r = S.math(String.raw`\htmlClass{e1}{{=}\;{-}\dfrac{26}{3}}\htmlClass{e2}{\;\approx\;-8.67}`, { at: '9a@negative-0.1', size: 52, gap: 18 });
    show(r, [['.e1', '9a@negative'], ['.e2', '9a@about']]);
    S.text('Level every column to one common height — that flat slab is the average.', { at: '9b@leveling', size: 27, wrap: true, gap: 30 });
    S.text('A negative average is perfectly valid.', { at: '9b@negative', size: 27, gap: 10 });
    S.label('The takeaway', { at: '9c+0.3', gap: 62 });
    S.text(`${OK}&ensp;Region`, { at: '9c@region', size: 30 });
    S.text(`${OK}&ensp;Function`, { at: '9c@function', size: 30, gap: 8 });
    S.text(`${OK}&ensp;Order of integration`, { at: '9c@order', size: 30, gap: 8 });
    S.text('The single fix — the number out front:', { at: '9c@single', size: 28, gap: 44 });
    const fx = S.math(String.raw`\htmlClass{h1}{\dfrac{1}{13.5}}\htmlClass{h2}{\;\;\longrightarrow\;\;\dfrac{1}{A(\D)}}\htmlClass{h3}{\;{=}\;\htmlClass{h4}{\dfrac{2}{25}}}`, { at: '9c@number', size: 42, gap: 22 });
    show(fx, [['.h2', '9c@one'], ['.h3', '9c@two']]);
    strike(fx, '.h1', after('9c@one', 0.5));
    ring(fx, '.h4', after('9c@two+0.4', 0.5), { color: 'var(--good)', pad: 9 });
  }
}

export default function build() {
  const P = tracks();
  const { means } = world3d(P);
  panels(P, means);
  return { camera: P.cam };
}
