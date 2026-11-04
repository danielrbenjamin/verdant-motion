import { defineConfig } from 'vite';
import { licenseAssets } from './scripts/license-assets.mjs';
export default defineConfig({
  plugins: [licenseAssets()],
  publicDir: false,
  build: {
    outDir: 'dist/lib',
    lib: { entry: 'src/lib/index.ts', formats: ['es'], fileName: () => 'verdant-motion.js' },
    rolldownOptions: { external: (id) => id === 'three' || id.startsWith('three/') },
  },
});
