"""Transcribe every narration clip with Whisper and print it beside the script.

    python tools/hear.py videos/<name>

An agent cannot listen to the audio; this is the substitute. Read the pairs and look for
mispronounced maths ("d x" heard as "the x") and for homophones that would confuse a listener
("plain average" heard as "plane average" in a video full of planes). Lines whose words differ
are marked with "!!" — numerals vs. spelled-out numbers are normal and not a problem.
"""
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import mlx_whisper

MODEL = "mlx-community/whisper-large-v3-turbo"
root = Path(sys.argv[1])
spec = json.loads((root / "narration.json").read_text())
cues = spec["cues"] if isinstance(spec, dict) else spec
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower()).split()

for cue in cues:
    if "silence" in cue:
        continue
    heard = mlx_whisper.transcribe(str(root / "audio" / f"{cue['id']}.wav"), path_or_hf_repo=MODEL, language="en", verbose=None)["text"].strip()
    flag = "  " if norm(heard) == norm(cue["text"]) else "!!"
    print(f"{flag} {cue['id']} SAID : {cue['text']}\n{flag} {cue['id']} HEARD: {heard}\n")
