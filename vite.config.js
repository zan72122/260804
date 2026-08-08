import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained index.html so the game can be opened from any
// static host (or straight off a phone) with no module/CORS setup.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 8000,
    cssCodeSplit: false,
  },
});
