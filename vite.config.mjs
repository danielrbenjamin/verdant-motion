import { defineConfig } from 'vite';
import { licenseAssets } from './scripts/license-assets.mjs';
export default defineConfig({
  plugins: [licenseAssets()],
  base: process.env.BASE_PATH || '/',
  build: { outDir: 'dist/demo' },
});
