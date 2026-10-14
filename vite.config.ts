import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** The humanoid package's assets (bodies, clips), served and built under /humanoid/ (see src/render/nobody.ts). */
const HUMANOID_ASSETS = path.resolve('vendor/assetgenerator/packages/humanoid/assets');

function humanoidAssets(): Plugin {
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return {
    name: 'humanoid-assets',
    configureServer(server) {
      server.middlewares.use('/humanoid/', (req, res, next) => {
        const file = path.join(HUMANOID_ASSETS, decodeURIComponent((req.url ?? '').split('?')[0]));
        if (!file.startsWith(HUMANOID_ASSETS + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
        res.end(fs.readFileSync(file));
      });
    },
    generateBundle() {
      for (const f of files(HUMANOID_ASSETS)) {
        this.emitFile({ type: 'asset', fileName: 'humanoid/' + path.relative(HUMANOID_ASSETS, f).split(path.sep).join('/'), source: fs.readFileSync(f) });
      }
    },
  };
}

// `npm run build:publish` builds for the shared host's /dunfinity/ subpath (DUNFINITY_BASE overrides it);
// the plain build stays root-relative for local previews.
export default defineConfig(({ mode }) => ({
  base: mode === 'publish' ? (process.env.DUNFINITY_BASE ?? '/dunfinity/') : '/',
  plugins: [humanoidAssets()],
  // One three.js: the vendored packages have their own node_modules (for their tests), and a second
  // copy would split TSL's state ("No stack defined for assign").
  resolve: { dedupe: ['three'] },
  server: { port: 5190, host: true, fs: { allow: ['.', 'vendor/assetgenerator/packages'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 2000 },
}));
