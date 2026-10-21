import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * The Actors asset pack (tools/actors/pack.mjs fetches it into .actors-pack/<version>/), served and
 * built under /actors/ (src/render/actors/pack.ts). The CMU mocap library stays out.
 */
function actorsPack(): Plugin {
  const version = (): string => JSON.parse(fs.readFileSync(path.resolve('node_modules/@actors/generator/package.json'), 'utf8')).version;
  const dir = (): string => path.resolve('.actors-pack', version());
  const wanted = (rel: string): boolean => !rel.split(path.sep).join('/').startsWith('human/clips/cmu');
  let outDir = 'dist';
  return {
    name: 'actors-pack',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use('/actors/', (req, res, next) => {
        const root = dir();
        const file = path.join(root, decodeURIComponent((req.url ?? '').split('?')[0]));
        if (!file.startsWith(root + path.sep) || !wanted(path.relative(root, file)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
        res.end(fs.readFileSync(file));
      });
    },
    closeBundle() {
      const root = dir();
      if (!fs.existsSync(path.join(root, 'human/manifest.json'))) throw new Error(`No Actors pack in ${root}: run node tools/actors/pack.mjs`);
      fs.cpSync(root, path.join(outDir, 'actors'), { recursive: true, dereference: true, filter: (src) => wanted(path.relative(root, src)) });
    },
  };
}

// `npm run build:publish` builds for the shared host's /dunfinity/ subpath (DUNFINITY_BASE overrides it);
// the plain build stays root-relative for local previews.
export default defineConfig(({ mode }) => ({
  base: mode === 'publish' ? (process.env.DUNFINITY_BASE ?? '/dunfinity/') : '/',
  plugins: [actorsPack()],
  // One three.js: the vendored packages have their own node_modules (for their tests), and a second
  // copy would split TSL's state ("No stack defined for assign").
  resolve: { dedupe: ['three'] },
  server: { port: 5190, host: true, fs: { allow: ['.', 'vendor/assetgenerator/packages'] } },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    // three.js in a chunk of its own: it changes only on an upgrade, so a new deploy of the game
    // leaves it in the browser's cache, and the entry stays under the warning limit.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] } } },
  },
}));
