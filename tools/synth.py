"""Narration -> audio + word-level timeline, with Kokoro.

    python tools/synth.py videos/<name> [--voice af_heart] [--speed 1.0]

Reads   videos/<name>/narration.json   a list of cues, or {"voice", "speed", "cues": [...]}
          cue: {"id": "1a", "scene": "s1", "text": "...", "gap": 0.3}
               {"id": "p1", "scene": "s1", "silence": 4.0}        a silent beat, no speech
Writes  videos/<name>/audio/<id>.wav    one clip per cue (cached by text, voice and speed)
        videos/<name>/audio/narration.wav
        videos/<name>/timeline.json     start/end of every scene, cue and spoken word

Scenes are consecutive runs of cues sharing a "scene" id. "gap" is the silence after a cue
(default 0.3 s); give the last cue of a scene about 1.1 s so transitions have room.
"""
import argparse
import hashlib
import json
import logging
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)

import numpy as np
import soundfile as sf

SR = 24000
LEAD_IN = 1.0
DEFAULT_GAP = 0.30


def speak(pipe, text, voice, speed):
    chunks, words, offset = [], [], 0.0
    for result in pipe(text, voice=voice, speed=speed):
        audio = result.audio.cpu().numpy().astype(np.float32)
        for tok in result.tokens or []:
            if tok.start_ts is None or tok.end_ts is None:
                continue
            word = tok.text.strip().strip(".,:;?!\"'()").lower()
            if word:
                words.append({"w": word, "s": round(offset + tok.start_ts, 3), "e": round(offset + tok.end_ts, 3)})
        chunks.append(audio)
        offset += len(audio) / SR
    return np.concatenate(chunks), words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--voice")
    ap.add_argument("--speed", type=float)
    args = ap.parse_args()

    root = Path(args.video)
    spec = json.loads((root / "narration.json").read_text())
    cues = spec["cues"] if isinstance(spec, dict) else spec
    voice = args.voice or (spec.get("voice") if isinstance(spec, dict) else None) or "af_heart"
    speed = args.speed or (spec.get("speed") if isinstance(spec, dict) else None) or 1.0

    ids = [c["id"] for c in cues]
    if len(set(ids)) != len(ids):
        raise SystemExit("narration.json: cue ids must be unique")
    clash = set(ids) & {c["scene"] for c in cues}
    if clash:
        raise SystemExit(f"narration.json: {sorted(clash)} used as both a cue id and a scene id; time expressions could not tell them apart")
    audio_dir = root / "audio"
    audio_dir.mkdir(exist_ok=True)

    pipe = None
    track = [np.zeros(int(LEAD_IN * SR), dtype=np.float32)]
    t = LEAD_IN
    timeline = {"voice": voice, "speed": speed, "cues": {}, "scenes": {}, "order": []}

    for cue in cues:
        wav, meta = audio_dir / f"{cue['id']}.wav", audio_dir / f"{cue['id']}.json"
        if "silence" in cue:
            audio, words, state = np.zeros(int(float(cue["silence"]) * SR), dtype=np.float32), [], "silent"
        else:
            key = hashlib.sha256(f"{voice}|{speed}|{cue['text']}".encode()).hexdigest()[:16]
            cached = meta.exists() and wav.exists() and json.loads(meta.read_text()).get("key") == key
            if cached:
                audio, _ = sf.read(wav, dtype="float32")
                words, state = json.loads(meta.read_text())["words"], "cached"
            else:
                if pipe is None:
                    from kokoro import KPipeline  # imported late: silent-only videos need no TTS at all
                    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
                audio, words = speak(pipe, cue["text"], voice, speed)
                sf.write(wav, audio, SR)
                meta.write_text(json.dumps({"key": key, "words": words}))
                state = "new"

        dur = len(audio) / SR
        gap = cue.get("gap", 0.0 if "silence" in cue else DEFAULT_GAP)
        timeline["cues"][cue["id"]] = {
            "scene": cue["scene"], "start": round(t, 3), "end": round(t + dur, 3), "text": cue.get("text", ""),
            "words": [{"w": w["w"], "s": round(t + w["s"], 3), "e": round(t + w["e"], 3)} for w in words],
        }
        timeline["order"].append(cue["id"])
        scene = timeline["scenes"].setdefault(cue["scene"], {"start": round(t, 3)})
        scene["end"] = round(t + dur + gap, 3)
        track += [audio, np.zeros(int(gap * SR), dtype=np.float32)]
        t += dur + int(gap * SR) / SR
        print(f"{cue['id']:>5}  {dur:6.2f}s  {state:<6}  {cue.get('text', '(silence)')[:64]}")

    full = np.concatenate(track)
    timeline["duration"] = round(len(full) / SR, 3)
    sf.write(audio_dir / "narration.wav", full, SR)
    (root / "timeline.json").write_text(json.dumps(timeline, indent=1))
    print(f"total {timeline['duration']:.1f}s ({timeline['duration'] / 60:.2f} min), voice {voice}, speed {speed}")


if __name__ == "__main__":
    main()
