// Time expressions: one way to name a moment in a video, shared by the page and the CLI.
//
//   12.5            seconds from the start
//   "4b"            when cue 4b starts              "4b$"   when it ends
//   "4b@leave"      when "leave" is spoken in 4b    "4b@the#2"  its second "the"   "4b@leave$" when the word ends
//   "s3" / "s3$"    start / end of scene s3
//   any of these plus or minus seconds:  "4b@leave+0.5"   "s3$-0.6"
//
// Cue ids win over scene ids if both exist.

export function resolveTime(tl, expr) {
  if (typeof expr === 'number') return expr;
  const text = String(expr).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text); // plain decimals only: "1e+2" is cue 1e plus 2 s

  const off = /([+-]\d*\.?\d+)$/.exec(text);
  const offset = off ? Number(off[1]) : 0;
  const base = off ? text.slice(0, off.index) : text;

  const [head, wordPart] = base.split('@');
  const end = head.endsWith('$');
  const id = end ? head.slice(0, -1) : head;
  const cue = tl.cues[id];
  const span = cue || tl.scenes[id];
  if (!span) throw new Error(`time "${expr}": no cue or scene named "${id}"`);
  if (wordPart === undefined) return (end ? span.end : span.start) + offset;

  if (!cue) throw new Error(`time "${expr}": "${id}" is a scene, and only cues have words`);
  const wordEnd = wordPart.endsWith('$'); // "4b@leave$" = when the word finishes
  const [word, nth] = (wordEnd ? wordPart.slice(0, -1) : wordPart).split('#');
  const n = nth ? Number(nth) : 1;
  const hits = cue.words.filter(w => w.w === word.toLowerCase());
  if (hits.length < n) {
    throw new Error(`time "${expr}": cue ${id} has ${hits.length} "${word}" (words: ${cue.words.map(w => w.w).join(' ')})`);
  }
  return (wordEnd ? hits[n - 1].e : hits[n - 1].s) + offset;
}

/** The cue being spoken (or most recently started) at time t. */
export function cueAt(tl, t) {
  let current = null;
  for (const id of tl.order) {
    if (tl.cues[id].start <= t) current = id; else break;
  }
  return current;
}
