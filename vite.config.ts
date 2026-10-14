import { defineConfig } from 'vite';

// `npm run build:publish` builds for the shared host's /dunfinity/ subpath (DUNFINITY_BASE overrides it);
// the plain build stays root-relative for local previews.
export default defineConfig(({ mode }) => ({
  base: mode === 'publish' ? (process.env.DUNFINITY_BASE ?? '/dunfinity/') : '/',
  server: { port: 5190, host: true, fs: { allow: ['.', 'vendor/assetgenerator/packages'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 2000 },
}));
