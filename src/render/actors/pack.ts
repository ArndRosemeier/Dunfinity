/**
 * Where the Actors asset pack is served (vite.config.ts serves and builds it under /actors/,
 * tools/actors/pack.mjs fetches it), and the one place its files are fetched: each file once,
 * shared by every figure (a figure parses its own copy).
 */
import type { Fetcher } from '@actors/core';
import { Character, buildCatalog, defaultConfig, type CharacterCatalog, type CharacterConfig } from '@actors/generator';
import { Human } from '@actors/human';
import { IRIS_PRESETS } from '@actors/three';
import { today, uncredited } from './today';

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

type Catalog = { catalog: CharacterCatalog; base: CharacterConfig };
let full: Promise<CharacterCatalog> | undefined;
const narrowed = new Map<(c: CharacterCatalog) => CharacterCatalog, Promise<Catalog>>();

/** The pack's whole catalog, loaded once. */
function packCatalog(): Promise<CharacterCatalog> {
  full ??= Human.load(HUMAN_PACK, packFetch).then((human) => buildCatalog(human, Object.keys(IRIS_PRESETS)));
  return full;
}

/** The catalog narrowed by `by`, and its default look, made once. */
function catalogOf(by: (c: CharacterCatalog) => CharacterCatalog): Promise<Catalog> {
  let c = narrowed.get(by);
  if (!c) {
    c = packCatalog().then((all) => {
      const catalog = by(all);
      return { catalog, base: defaultConfig(catalog) };
    });
    narrowed.set(by, c);
  }
  return c;
}

/** What the pack offers people of today (`today`) and the default look. */
export const humanCatalog = (): Promise<Catalog> => catalogOf(today);

/** What the pack offers every people the game draws (`uncredited`: goblins, the peoples of the deep...), and the default look. */
export const folkCatalog = (): Promise<Catalog> => catalogOf(uncredited);

export { Character };
