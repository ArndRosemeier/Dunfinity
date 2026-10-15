#!/usr/bin/env python3
"""Dunfinity's sound effects: generated with ByteDance Seed Audio, screened by a listening model, cut.

    python3 tools/audio/sfx.py gen    RAW [id ...] [--n N]   takes from Seed Audio (RAW/<id>/takeK.wav)
    python3 tools/audio/sfx.py screen RAW [id ...]           a listening model's verdict per take (takeK.json)
    python3 tools/audio/sfx.py build  RAW [id ...]           cut the best into public/sounds/ + manifest.json

The sounds are listed in tools/audio/sounds.json. Seed Audio is a speech model; an input starting with
"The sound of" makes it render the sound instead of reading the words out (Arnd's find). It costs
0.25 cents per second of audio and takes 10-30 s per take. The listener (Gemini, through OpenRouter)
hears each take blind first and lists its events with times; a second, text-only call scores each
event against the sound wanted (Scale's tools/sfx/generate.py). Only a ranking: the ear decides.
RAW in the project: /mnt/project-files/dunfinity/sounds/raw. Needs OPEN_ROUTER_KEY, ffmpeg, numpy, soundfile.
"""
import base64, json, os, subprocess, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'sounds')
API = 'https://openrouter.ai/api/v1'
LISTENER = os.environ.get('SFX_LISTENER', 'google/gemini-3.8-flash')
SR = 24000


def call(path, body, timeout=300):
    req = urllib.request.Request(API + path, json.dumps(body).encode(), {
        'Authorization': 'Bearer ' + os.environ['OPEN_ROUTER_KEY'], 'Content-Type': 'application/json'})
    for k in range(5):
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503) or k == 4:
                raise
            time.sleep(4 * (k + 1))


def sounds(ids):
    d = {k: v for k, v in json.load(open(os.path.join(HERE, 'sounds.json'))).items() if not k.startswith('_')}
    return {k: d[k] for k in ids} if ids else d


# ------------------------------------------------------------------ gen

def gen(raw, ids, n):
    jobs = [(sid, s, k) for sid, s in sounds(ids).items() for k in range(1, (2 if s['kind'] == 'loop' else n) + 1)]

    def one(job):
        sid, s, k = job
        wav = os.path.join(raw, sid, f'take{k}.wav')
        if os.path.exists(wav):
            return
        os.makedirs(os.path.dirname(wav), exist_ok=True)
        t = time.time()
        try:
            pcm = call('/audio/speech', {'model': 'bytedance-seed/seed-audio-1-0', 'input': 'The sound of ' + s['seed']}, 240).read()
        except urllib.error.HTTPError as e:
            print(f'{sid} take{k}: refused, {e.code} {e.read()[:200]!r}', flush=True)
            return
        # Raw PCM: signed 16-bit, 24 kHz, stereo.
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:', wav], input=pcm, check=True)
        print(f'{sid} take{k}: {len(pcm) / (SR * 4):.1f} s in {time.time() - t:.0f} s', flush=True)

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(one, jobs))


# ------------------------------------------------------------------ screen

def chat(content):
    body = {'model': LISTENER, 'temperature': 0, 'response_format': {'type': 'json_object'},
            'messages': [{'role': 'user', 'content': content}]}
    txt = json.load(call('/chat/completions', body))['choices'][0]['message']['content'].strip()
    if txt.startswith('```'):
        txt = txt.strip('`').split('\n', 1)[1]
    return json.loads(txt)


def listen(wav, want):
    """Blind listening first (the target would bias it), then a text-only match against the target."""
    mp3 = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', wav, '-b:a', '128k', '-f', 'mp3', 'pipe:'], capture_output=True, check=True).stdout
    heard = chat([{'type': 'text', 'text':
                   'Listen to this audio and identify, blind, every separate sound event with exact times. Answer ONLY with JSON '
                   '{"music": true/false, "speech": true/false, "events": [{"start": seconds, "end": seconds, "what": "what makes the sound, how it sounds"}]}. '
                   '"music" = any melody, chords, beat or instruments; "speech" = any intelligible words.'},
                  {'type': 'input_audio', 'input_audio': {'data': base64.b64encode(mp3).decode(), 'format': 'mp3'}}])
    events = heard.get('events', [])
    judged = chat([{'type': 'text', 'text':
                    f'A game needs this sound effect: {want}. A listener heard these events in a generated clip: {json.dumps(events)}. '
                    'For each event give a score 0-10: how well it serves as that sound effect (10 = clearly that sound, 5 = plausible '
                    'stand-in, 0 = something else). Answer ONLY with JSON {"scores": [numbers in the same order]}.'}])
    sc = judged.get('scores', [])
    for i, e in enumerate(events):
        e['score'] = sc[i] if i < len(sc) else 0
        if heard.get('music') or heard.get('speech'):
            e['score'] = min(e['score'], 4)
    return heard


def screen(raw, ids):
    work = [(sid, s, os.path.join(raw, sid, f)) for sid, s in sounds(ids).items() if os.path.isdir(os.path.join(raw, sid))
            for f in sorted(os.listdir(os.path.join(raw, sid))) if f.endswith('.wav') and not os.path.exists(os.path.join(raw, sid, f[:-4] + '.json'))]

    def one(job):
        sid, s, wav = job
        for _ in range(3):
            try:
                v = listen(wav, s['sound'])
                json.dump(v, open(wav[:-4] + '.json', 'w'), indent=1)
                print(f"{sid} {os.path.basename(wav)}: " + '; '.join(f"{e['score']} {e.get('what', '')[:40]}" for e in v.get('events', [])[:4]), flush=True)
                return
            except Exception as e:  # a malformed answer: ask again
                print(sid, wav, 'error', e, flush=True)

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(one, work))


# ------------------------------------------------------------------ build

def rms_env(x, hop=120):
    n = len(x) // hop
    return np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12), hop


def cut_event(x, start, end, maxlen):
    """The event near [start, end] (s): from its onset (5 ms pre-roll) to where it has died away, at most maxlen, faded out."""
    a, b = max(0, int((start - 0.25) * SR)), min(len(x), int((end + 0.3) * SR))
    seg = x[a:b]
    if len(seg) < SR // 20:
        return None
    env, hop = rms_env(seg)
    peak = env.max()
    on = int(np.argmax(env > peak * 0.12))
    after = np.nonzero(env[on:] > peak * 0.03)[0]
    off = on + (after[-1] + 1 if len(after) else 1)
    i0 = max(0, on * hop - int(0.005 * SR))
    i1 = min(len(seg), off * hop + int(0.04 * SR), i0 + int(maxlen * SR))
    out = seg[i0:i1].copy()
    fo = min(len(out) // 3, int(0.06 * SR))
    if fo > 0:
        out[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    fi = min(len(out) // 10, int(0.003 * SR))
    if fi > 0:
        out[:fi] *= np.linspace(0, 1, fi)
    return out


def loop_of(x, maxlen, xf=2.0):
    """An ambience bed: the steadiest stretch, its tail cross-faded (equal power) into its head."""
    x = x[int(0.3 * SR):len(x) - int(0.3 * SR)]
    n = min(len(x), int((maxlen + xf) * SR))
    x = x[:n]
    k = int(xf * SR)
    body, tail = x[:n - k].copy(), x[n - k:]
    t = np.linspace(0, np.pi / 2, k)[:, None] if x.ndim == 2 else np.linspace(0, np.pi / 2, k)
    body[:k] = body[:k] * np.sin(t) + tail * np.cos(t)
    return body


def build(raw, ids):
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for sid, s in sounds(ids).items():
        d = os.path.join(raw, sid)
        cands = []
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if not f.endswith('.json'):
                continue
            v = json.load(open(os.path.join(d, f)))
            for e in v.get('events', []):
                cands.append((e.get('score', 0), f[:-5], e))
        if not cands:
            print(sid, 'no screened takes')
            continue
        cands.sort(key=lambda c: -c[0])
        files = []
        if s['kind'] == 'loop':
            # The take whose events score best as a whole.
            by = {}
            for sc, take, _ in cands:
                by.setdefault(take, []).append(sc)
            take = max(by, key=lambda t: np.mean(by[t]))
            x, _ = sf.read(os.path.join(d, take + '.wav'), always_2d=True)
            y = loop_of(x, s['max'])
            y *= 10 ** (-24 / 20) / max(1e-9, np.sqrt(np.mean(y ** 2)))
            y = np.clip(y, -0.98, 0.98)
            files.append(write(sid, None, y))
            print(f'{sid}: loop from {take} ({len(y) / SR:.1f} s, score {np.mean(by[take]):.1f})')
        else:
            used = []
            for sc, take, e in cands:
                if len(files) >= s['files'] or sc < 5:
                    break
                st, en = float(e.get('start', 0)), float(e.get('end', 0))
                if any(t == take and abs(st - u) < 0.3 for t, u in used):
                    continue
                x, _ = sf.read(os.path.join(d, take + '.wav'), always_2d=True)
                y = cut_event(x.mean(axis=1), st, max(en, st + 0.1), s['max'])
                if y is None or len(y) < SR * 0.04:
                    continue
                y *= 10 ** (-1 / 20) / max(1e-9, np.abs(y).max())
                used.append((take, st))
                files.append(write(sid, len(files) + 1, y))
                print(f'{sid} #{len(files)}: {take} @{st:.2f}s, {len(y) / SR:.2f} s, score {sc}: {e.get("what", "")[:50]}')
        if files:
            man[sid] = {'files': files, 'loop': s['kind'] == 'loop', 'gain': s['gain']}
    json.dump(dict(sorted(man.items())), open(man_path, 'w'), indent=1)


def write(sid, k, y):
    name = f'{sid}.ogg' if k is None else f'{sid}_{k}.ogg'
    tmp = os.path.join(OUT, name + '.wav')
    sf.write(tmp, y, SR)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libvorbis', '-q:a', '4', os.path.join(OUT, name)], check=True)
    os.remove(tmp)
    return name


if __name__ == '__main__':
    args = sys.argv[1:]
    n = 3
    if '--n' in args:
        i = args.index('--n'); n = int(args[i + 1]); del args[i:i + 2]
    cmd, raw, ids = args[0], args[1], args[2:]
    {'gen': lambda: gen(raw, ids, n), 'screen': lambda: screen(raw, ids), 'build': lambda: build(raw, ids)}[cmd]()
