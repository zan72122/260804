// Bundles src/ + vendor/three into a single self-contained index.html.
// Run: node build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['safari15', 'chrome90'],
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'info',
});

const js = res.outputFiles[0].text;
const tpl = readFileSync('index.template.html', 'utf8');
const html = tpl.replace('<!--BUNDLE-->', () =>
  '<script>/* three.js r169 (MIT) — see vendor/three/LICENSE */\n' + js + '\n</script>');
writeFileSync('index.html', html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' kB');
