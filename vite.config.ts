import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The game ships as one self-contained HTML file so it can be opened straight
// from a phone (AirDrop / file://) as well as served over http.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 4096,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: { host: true },
});
