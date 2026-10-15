#!/usr/bin/env python3
"""Dunfinity's score: Lyria 3 Pro pieces (OpenRouter), cut and levelled for the game.

    python3 tools/audio/music.py gen   RAW [name ...]   ask Lyria for each piece (RAW/<name>.mp3)
    python3 tools/audio/music.py build RAW [name ...]   build public/music/tracks/ and tracks.json

The pieces and their prompts are in tools/audio/music.json. A Lyria 3 Pro piece is about three
minutes, costs 8 cents and takes about half a minute. The build is Scale's tools/music/build_tracks.py:

  stream  a piece played once: silence trimmed, an optional cut and fade, normalised to TARGET_LUFS,
          MP3 (streamed by an audio element, nothing decoded up front)
  loop    a danger loop: the lag where the music lines up with itself best, its tail cross-faded
          over its head so it wraps seamlessly; Ogg Vorbis (decoded and looped sample-exact)

RAW in the project: /mnt/project-files/dunfinity/music/lyria. Needs OPEN_ROUTER_KEY, ffmpeg, numpy,
librosa, soundfile.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / 'public' / 'music' / 'tracks'
MANIFEST = ROOT / 'public' / 'music' / 'tracks.json'
SR = 44100
TARGET_LUFS = -16.0
SPEC = {k: v for k, v in json.loads((HERE / 'music.json').read_text()).items() if not k.startswith('_')}
STYLE = json.loads((HERE / 'music.json').read_text())['_style']


def gen(raw: Path, name: str) -> None:
    dest = raw / f'{name}.mp3'
    if dest.exists():
        return
    body = {'model': 'google/lyria-3-pro-preview', 'stream': True, 'modalities': ['text', 'audio'], 'audio': {'format': 'mp3'},
            'messages': [{'role': 'user', 'content': f"{STYLE} {SPEC[name]['prompt']}"}]}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', json.dumps(body).encode(),
                                 {'Authorization': 'Bearer ' + os.environ['OPEN_ROUTER_KEY'], 'Content-Type': 'application/json'})
    t, chunks, cost = time.time(), [], 0.0
    # Audio only comes streamed: base64 pieces in the deltas.
    with urllib.request.urlopen(req, timeout=900) as r:
        for line in r:
            line = line.decode().strip()
            if not line.startswith('data:') or line == 'data: [DONE]':
                continue
            d = json.loads(line[5:])
            cost = (d.get('usage') or {}).get('cost', cost)
            for c in d.get('choices', []):
                a = (c.get('delta') or {}).get('audio') or {}
                if a.get('data'):
                    chunks.append(base64.b64decode(a['data']))
    raw.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b''.join(chunks))
    print(f'{name}: {sum(map(len, chunks)) / 1e6:.1f} MB in {time.time() - t:.0f} s, ${cost:.2f}', flush=True)


def load(path: Path) -> np.ndarray:
    y, _ = librosa.load(str(path), sr=SR, mono=False)
    return np.atleast_2d(y)


def lufs(y: np.ndarray) -> float:
    """Integrated loudness (ffmpeg's ebur128 on a temp file)."""
    tmp = OUT / '_lufs.wav'
    sf.write(tmp, y.T, SR)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(tmp), '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    tmp.unlink()
    for line in reversed(r.stderr.splitlines()):
        if line.strip().startswith('I:'):
            return float(line.split()[1])
    raise RuntimeError('no loudness')


def normalise(y: np.ndarray, target: float) -> np.ndarray:
    g = 10 ** ((target - lufs(y)) / 20)
    y = y * g
    peak = np.abs(y).max()
    # Soft ceiling instead of clipping (rare: the sources are mastered loud).
    return np.tanh(y / 0.98) * 0.98 if peak > 0.98 else y


def trim(y: np.ndarray, head: bool = True) -> np.ndarray:
    mono = np.abs(y).max(axis=0)
    on = np.where(mono > 10 ** (-50 / 20))[0]
    if not len(on):
        return y
    a = max(0, on[0] - int(0.02 * SR)) if head else 0
    b = min(y.shape[1], on[-1] + int(0.3 * SR))
    return y[:, a:b]


def fades(y: np.ndarray, fade_in: float = 0.0, fade_out: float = 0.0) -> np.ndarray:
    y = y.copy()
    if fade_in > 0:
        n = int(fade_in * SR)
        y[:, :n] *= np.linspace(0, 1, n) ** 2
    if fade_out > 0:
        n = int(fade_out * SR)
        y[:, -n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return y


def find_loop(y: np.ndarray, window: list[float], length: list[float], xf: float) -> tuple[int, int, float]:
    """(start, length) in samples of the best loop: where the music after `length` lines up with itself."""
    mono = librosa.to_mono(y)
    hop = 256
    onset = librosa.onset.onset_strength(y=mono, sr=SR, hop_length=hop)
    chroma = librosa.feature.chroma_stft(y=mono, sr=SR, hop_length=hop)
    fps = SR / hop
    W = int(8 * fps)
    a0, a1 = int(window[0] * fps), int(window[1] * fps)
    lmin, lmax = int(length[0] * fps), int(length[1] * fps)
    best = (-1e9, 0, 0)
    # Starts: the strongest onsets near the window's start (a downbeat is likelier there).
    region = onset[a0:a0 + int(6 * fps)]
    starts = [a0 + int(i) for i in np.argsort(region)[-6:]]
    for s in starts:
        A = onset[s:s + W]
        C = chroma[:, s:s + W]
        if len(A) < W:
            continue
        A = (A - A.mean()) / (A.std() + 1e-9)
        for L in range(lmin, lmax + 1):
            if s + L + W + int(xf * fps) > a1:
                break
            B = onset[s + L:s + L + W]
            B = (B - B.mean()) / (B.std() + 1e-9)
            r = float(np.dot(A, B) / W)
            D = chroma[:, s + L:s + L + W]
            c = float(np.mean(np.sum(C * D, axis=0) / (np.linalg.norm(C, axis=0) * np.linalg.norm(D, axis=0) + 1e-9)))
            score = r + 0.8 * c
            if score > best[0]:
                best = (score, s, L)
    score, s, L = best
    if L == 0:
        raise RuntimeError('no loop found')
    # Refine the lag to the sample on the waveform's envelope (±1 hop).
    s_smp, L_smp = s * hop, L * hop
    env = np.abs(mono)
    n = int(4 * SR)
    ref = env[s_smp:s_smp + n]
    bestc, bestd = -1e9, 0
    for d in range(-hop, hop + 1, 4):
        seg = env[s_smp + L_smp + d:s_smp + L_smp + d + n]
        if len(seg) < n:
            continue
        c = float(np.dot(ref - ref.mean(), seg - seg.mean()))
        if c > bestc:
            bestc, bestd = c, d
    return s_smp, L_smp + bestd, score


def make_loop(y: np.ndarray, s: int, L: int, xf: float) -> np.ndarray:
    """The loop with its tail (after L) cross-faded over its head: wraps without a seam."""
    n = int(xf * SR)
    seg = y[:, s:s + L + n]
    out = seg[:, :L].copy()
    t = np.linspace(0, np.pi / 2, n)
    out[:, :n] = seg[:, :n] * np.sin(t) + seg[:, L:L + n] * np.cos(t)
    return out


def encode(y: np.ndarray, dest: Path, fmt: str) -> None:
    tmp = dest.with_suffix('.wav')
    sf.write(tmp, y.T, SR, subtype='PCM_16')
    if fmt == 'mp3':
        args = ['-c:a', 'libmp3lame', '-b:a', '128k']
    else:
        args = ['-c:a', 'libvorbis', '-q:a', '5' if y.shape[0] > 1 else '4']
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp), *args, str(dest)], check=True)
    tmp.unlink()


def build(raw: Path, name: str, info: dict) -> None:
    o = SPEC[name]
    kind = o['kind']
    y = load(raw / f'{name}.mp3')
    if 'cut' in o:
        a, b = o['cut']
        y = y[:, int(a * SR):int(b * SR)]
    if kind == 'loop':
        xf = o.get('xf', 1.5)
        s, L, score = find_loop(y, o['window'], o['length'], xf)
        y = make_loop(y, s, L, xf)
        note = f'loop {L / SR:.3f} s from {s / SR:.2f} s (match {score:.2f})'
    else:
        y = trim(y)
        y = fades(y, o.get('fadeIn', 0), o.get('fade', 0))
        note = f'{y.shape[1] / SR:.1f} s'
    y = normalise(y, TARGET_LUFS)
    ext = 'mp3' if kind == 'stream' else 'ogg'
    dest = OUT / f'{name}.{ext}'
    encode(y, dest, ext)
    info[name] = {'file': f'tracks/{name}.{ext}', 'kind': kind, 'seconds': round(y.shape[1] / SR, 3)}
    print(f'{name}: {kind} {note} -> {dest.relative_to(ROOT)}')


def main() -> None:
    cmd, raw, names = sys.argv[1], Path(sys.argv[2]), sys.argv[3:] or list(SPEC)
    if cmd == 'gen':
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(3) as ex:
            list(ex.map(lambda n: gen(raw, n), names))
        return
    OUT.mkdir(parents=True, exist_ok=True)
    info = json.loads(MANIFEST.read_text())['tracks'] if MANIFEST.exists() else {}
    for n in names:
        build(raw, n, info)
    MANIFEST.write_text(json.dumps({'version': 1, 'tracks': dict(sorted(info.items()))}, indent=1) + '\n')


if __name__ == '__main__':
    main()
