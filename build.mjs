// Bundle the game (three.js included) into a single self-contained index.html.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: 'es2020',
});
const js = res.outputFiles[0].text;

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>ふんすいを なおそう！</title>
</head>
<body>
<script>${js}</script>
</body>
</html>`;

writeFileSync('index.html', html);
console.log(`index.html written (${(html.length / 1024).toFixed(0)} KB)`);
