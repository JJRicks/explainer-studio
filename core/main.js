// Page entry point. Loads one video (?video=<folder under videos/>) and exposes renderAt(t).
//   ?play    live preview with narration (click or space = play/pause, arrows = seek 5 s)
//   ?review  show a time / cue badge in the corner (used by stills and contact sheets)
import { loadTimeline, clock, frame, updateDom, layoutSubs, lintFrame, renderer, scene, camera, setCamera } from './engine.js';
import { layoutPanels } from './panel.js';
import { cueAt } from './timeexpr.js';

const KATEX_FONTS = ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_AMS', 'KaTeX_Size1', 'KaTeX_Size2', 'KaTeX_Size3', 'KaTeX_Size4'];
const params = new URLSearchParams(location.search);

function progressBar(TL) {
  const bar = document.getElementById('bar');
  const fills = Object.values(TL.scenes).map(s => {
    const seg = document.createElement('i');
    seg.style.flex = `${s.end - s.start} 0 0`;
    const fill = seg.appendChild(document.createElement('b'));
    bar.appendChild(seg);
    return { s, fill };
  });
  return t => { for (const { s, fill } of fills) fill.style.width = `${Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start))) * 100}%`; };
}

try {
  const name = params.get('video');
  if (!name) throw new Error('open this page as index.html?video=<name>');
  const TL = await loadTimeline(`/videos/${name}/timeline.json`);
  const video = await (await import(`/videos/${name}/video.js`)).default();
  const updateBar = progressBar(TL);

  await Promise.all(KATEX_FONTS.flatMap(fam => ['', 'italic ', 'bold '].map(style => document.fonts.load(`${style}20px ${fam}`))));
  await document.fonts.ready;
  layoutPanels();
  layoutSubs();

  const badge = document.getElementById('badge');
  if (params.has('review')) badge.style.display = 'block';
  window.renderAt = t => {
    clock.t = t;
    setCamera(video.camera());
    frame();
    renderer.render(scene, camera);
    updateDom();
    updateBar(t);
    if (params.has('review')) badge.textContent = `${t.toFixed(2)}s · ${cueAt(TL, t) ?? '-'}`;
  };
  window.lint = t => { window.renderAt(t); return lintFrame(); };
  window.duration = TL.duration;
  window.renderAt(0);

  if (params.has('play')) {
    const stage = document.getElementById('stage');
    const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
    fit(); addEventListener('resize', fit);
    const audio = new Audio(`/videos/${name}/audio/narration.wav`);
    const loop = () => { window.renderAt(audio.currentTime); requestAnimationFrame(loop); };
    addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
    addEventListener('keydown', e => {
      if (e.key === ' ') audio.paused ? audio.play() : audio.pause();
      if (e.key === 'ArrowRight') audio.currentTime += 5;
      if (e.key === 'ArrowLeft') audio.currentTime -= 5;
    });
    loop();
  }
  window.ready = true;
} catch (e) {
  document.getElementById('err').textContent = e.stack || String(e);
  window.failed = String(e.stack || e);
  throw e;
}
