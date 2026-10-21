/**
 * Where the Actors asset pack is served (vite.config.ts serves and builds it under /actors/,
 * tools/actors/pack.mjs fetches it), and the one place its files are fetched: each file once,
 * shared by every figure (a figure parses its own copy).
 */
import type { Fetcher } from '@actors/core';
import { Character, buildCatalog, defaultConfig, type CharacterCatalog, type CharacterConfig } from '@actors/generator';
import { Human } from '@actors/human';
import { IRIS_PRESETS } from '@actors/three';
import { today } from './today';

/** The human pack's manifest. */
export const HUMAN_PACK = `${import.meta.env.BASE_URL}actors/human/manifest.json`;

const files = new Map<string, Promise<ArrayBuffer>>();

/** Fetches a pack file once; every caller gets its own copy (a runtime may hand buffers on). */
export const packFetch: Fetcher = async (url) => {
  let job = files.get(url);
  if (!job) {
    job = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.arrayBuffer();
    });
    files.set(url, job);
    job.catch(() => files.delete(url));
  }
  return (await job).slice(0);
};

let catalog: Promise<{ catalog: CharacterCatalog; base: CharacterConfig }> | undefined;

/** What the pack offers people of today (`today`) and the default look, loaded once. */
export function humanCatalog(): Promise<{ catalog: CharacterCatalog; base: CharacterConfig }> {
  catalog ??= Human.load(HUMAN_PACK, packFetch).then((human) => {
    const c = today(buildCatalog(human, Object.keys(IRIS_PRESETS)));
    return { catalog: c, base: defaultConfig(c) };
  });
  return catalog;
}

export { Character };
