/**
 * The image model the lore tools paint with (OpenRouter's Muse, about a cent a picture): one picture
 * per call, and the game's scaled-down webp of it. Needs OPEN_ROUTER_KEY and ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const MODEL = 'meta/muse-image';
/** Pictures asked for at once (the API turns away many more). */
export const AT_ONCE = 4;

/** Paint `prompt` into `raw` (a webp). */
export async function paint(prompt: string, raw: string): Promise<void> {
  const r = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPEN_ROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt }),
  });
  if (!r.ok) throw new Error(`${raw}: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { data: { b64_json: string }[] };
  writeFileSync(raw, Buffer.from(j.data[0].b64_json, 'base64'));
}

/** The game's copy of a raw picture: `width` px wide, a small webp (`filter`: more ffmpeg filters after the scale). */
export function scaled(raw: string, out: string, width: number, filter = ''): void {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-vf', `scale=${width}:-2${filter ? `,${filter}` : ''}`, '-quality', '72', out]);
  console.log(`${raw} -> ${out}`);
}

/** Run `jobs` a few at a time. */
export async function inBatches<T>(jobs: readonly T[], run: (job: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < jobs.length; i += AT_ONCE) await Promise.all(jobs.slice(i, i + AT_ONCE).map(run));
}
