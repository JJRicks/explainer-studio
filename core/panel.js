// The text column on the right of the frame: a chapter title, then a stack of lines and
// equations that flow downward. Positions are measured, not hand-placed, so adding or
// resizing an item never means re-doing pixel arithmetic for everything below it.
import { mk, tx, K, win, T, TL, H } from './engine.js';

export const PANEL = { x: 1200, y: 136, w: 660, chapterY: 52 };
const stacks = [];
const GAP = { label: 34, afterLabel: 12, math: 22, text: 16 };

/**
 * A stack of panel items for one scene. Every item fades out when the scene ends.
 *
 *   const S = panel('s1');
 *   S.label('Your answer', { at: '1a+0.3' });
 *   const eq = S.math(String.raw`\int_0^5 ...`, { at: '1a@one', size: 46 });
 *   S.text('Both orders cover the same region.', { at: '1g' });
 *
 * Item options:
 *   at       when it fades in (time expression; default: scene start)
 *   out      when it fades out (default: end of the page / scene)
 *   size     font size in px        gap   space above it, overriding the default
 *   wrap     allow line wrapping to the panel width (default: single line)
 *   same     sit on the previous item's row (use with dx to place it beside)
 *   over     sit exactly on top of the previous item (overlays such as underbraces)
 *   dx       shift right by this many px
 *   cls, color, f   passed to mk()
 */
export function panel(sceneId, o = {}) {
  const st = { id: sceneId, x: o.x ?? PANEL.x, y: o.y ?? PANEL.y, w: o.w ?? PANEL.w, items: [], pageOut: [] };
  const sceneOut = o.out !== undefined ? T(o.out) : T(sceneId + '$') - 0.6;
  let page = 0, pending = 0;
  stacks.push(st);

  const add = (type, make, content, opt = {}) => {
    const tIn = T(opt.at ?? sceneId) + (opt.at === undefined ? 0.2 : 0);
    const item = { type, page, gap: opt.gap, extra: pending, same: !!opt.same, over: !!opt.over };
    pending = 0;
    const own = opt.out !== undefined ? T(opt.out) : null;
    const node = make(content, {
      x: st.x + (opt.dx || 0), size: opt.size, color: opt.color, f: opt.f, nolint: !!opt.over,
      cls: [opt.cls, opt.wrap ? 'wrap' : ''].filter(Boolean).join(' '),
      w: opt.wrap ? (opt.w ?? st.w - (opt.dx || 0)) : opt.w,
      a: () => win(tIn, own ?? st.pageOut[item.page] ?? sceneOut, opt.din ?? 0.5, 0.45),
    });
    item.node = node;
    node.item = item;
    st.items.push(item);
    return node;
  };

  return {
    out: sceneOut,
    label: (text, opt = {}) => add('label', mk, `<span class="lbl">${text}</span>`, { size: 20, ...opt }),
    text: (html, opt = {}) => add('text', mk, html, { size: 30, ...opt }),
    math: (latex, opt = {}) => add('math', tx, latex, { size: 40, ...opt }),
    /** Extra vertical space before the next item. */
    gap(px) { pending += px; return this; },
    /** Clear everything so far at time `at` and start again from the top of the column. */
    page(at) { st.pageOut[page] = T(at) - 0.5; page++; pending = 0; return this; },
  };
}

/** Assign y positions. Runs once after fonts load, while every node is still displayed. */
export function layoutPanels() {
  for (const st of stacks) {
    let y = st.y, page = 0, prev = null, bottom = st.y;
    for (const it of st.items) {
      if (it.page !== page) { page = it.page; y = st.y; prev = null; }
      const h = it.node.el.offsetHeight;
      if ((it.over || it.same) && prev) {
        it.node.y = prev.node.y;
        if (it.same) y = Math.max(y, it.node.y + h);
      } else {
        const gap = !prev ? 0 : it.gap ?? (it.type === 'label' ? GAP.label : prev.type === 'label' ? GAP.afterLabel : GAP[it.type]);
        it.node.y = y + gap + it.extra;
        y = it.node.y + h;
        prev = it;
      }
      bottom = Math.max(bottom, y);
    }
    if (bottom > H - 34) {
      throw new Error(`panel "${st.id}" runs ${Math.round(bottom - (H - 34))}px past the bottom of the frame — `
        + 'shrink sizes or gaps, or split it with S.page(at)');
    }
  }
}

/** Chapter titles above the panel: chapters([['s1', '1', 'What you submitted'], ...]). */
export function chapters(list, { x = PANEL.x, y = PANEL.chapterY } = {}) {
  list.forEach(([id, badge, title], i) => {
    const t0 = i === 0 ? 0.3 : T(id) - 0.1;
    const t1 = i === list.length - 1 ? TL.duration - 0.8 : T(id + '$') - 0.6;
    mk(`<span class="k">${badge}</span>${title}`, { cls: 'chapter', kind: 'chrome', x, y, slide: 0, a: () => win(t0, t1, 0.5, 0.4) });
  });
}

/** Inline helpers for panel text. */
export const OK = `<span class="good">${K('\\checkmark')}</span>`;
export const NO = '<span class="bad bold">×</span>';
